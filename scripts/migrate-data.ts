#!/usr/bin/env bun
/**
 * migrate-data.ts — Authorized one-shot data migration: shared team-db (dev
 * source) -> Turso (destination), with reconciliation.
 *
 * Scope (owner-approved): exactly source leads ids 1,2,6 (app_repair_requests)
 * and legacy payment id 1 (app_payments).
 *
 * Guarantees:
 *  - Source is READ-ONLY (SELECT via `team-db` CLI only).
 *  - Idempotent: INSERT OR IGNORE by primary key; guarded additive ALTER.
 *  - Preserves ids, timestamps, statuses, and all compatible business fields.
 *  - Legacy NULL currency -> 'USD'. INV-1001 preserved as legacy reference in
 *    app_payments — NO canonical HCSC invoice is created/renumbered
 *    (app_invoices / app_final_invoices stay untouched).
 *  - No invented request/lead relationship (legacy payment stays unlinked;
 *    it lives in app_payments which has no request_id, so the new-schema
 *    request_id NOT NULL constraint is not engaged and normal new-payment
 *    requirements are unchanged).
 *  - Provenance: additive nullable column app_payments.provenance (smallest
 *    safe schema adjustment; existing/new rows default NULL).
 *  - Stripe TEST / PayPal SANDBOX / email DRY RUN modes are not touched.
 *    No email is sent, no payments processed, nothing pushed/deployed.
 *
 * Usage:
 *   bun run migrate:data                 # dry-run: inspect + preview, no writes
 *   bun run migrate:data --apply         # apply schema adjustment + data copy
 *   bun run migrate:data --apply         # re-run = idempotency check
 *
 * Env: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN (values are never printed).
 * Prints only non-secret fields (ids, timestamps, statuses, amounts, currency,
 * legacy reference, provenance, match booleans). Never prints customer
 * name/email/phone/address/description or the Stripe session id.
 */
import { execSync } from 'node:child_process';
import { createClient } from '@libsql/client';

const APPLY = process.argv.includes('--apply');
const PROVENANCE = 'legacy-migrated|2026-08-08|teamdb-to-turso';

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error('BLOCKER: TURSO_DATABASE_URL is not set.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Source read (read-only, via team-db CLI)
// ---------------------------------------------------------------------------
function srcRows(sql: string): Record<string, unknown>[] {
  const out = execSync(`team-db "${sql}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(out) as Record<string, unknown>[];
}

const srcLeads = srcRows('SELECT * FROM app_repair_requests WHERE id IN (1,2,6) ORDER BY id');
const srcPay = srcRows('SELECT * FROM app_payments WHERE id = 1');

const LEAD_COLS = [
  'id', 'name', 'email', 'phone', 'address', 'appliance_type', 'brand', 'model',
  'description', 'preferred_date', 'preferred_time', 'status', 'created_at',
  'scheduled_date', 'scheduled_time', 'cancelled_at', 'appointment_start',
  'appointment_end', 'appointment_local_start', 'appointment_local_end',
  'appointment_tz', 'duration_minutes', 'confirmed_at', 'cancel_reason', 'updated_at',
];
const PAY_COLS = [
  'id', 'invoice_number', 'customer_name', 'customer_email', 'amount', 'currency',
  'stripe_session_id', 'status', 'created_at',
];

// Validate source shape — exact scope, fail loudly on drift
const leadIds = srcLeads.map((r) => Number(r.id)).sort((a, b) => a - b);
if (srcLeads.length !== 3 || leadIds.join(',') !== '1,2,6') {
  console.error(`BLOCKER: source leads = ${leadIds.join(',') || '(none)'} — expected exactly 1,2,6. Aborting (no writes).`);
  process.exit(1);
}
if (srcPay.length !== 1 || Number(srcPay[0].id) !== 1) {
  console.error('BLOCKER: source legacy payment is not exactly id=1. Aborting (no writes).');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Destination connection + schema inspection (read-only first)
// ---------------------------------------------------------------------------
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });

async function run(sql: string) {
  return client.execute(sql);
}
function fmt(e: unknown): string {
  return String((e as Error).message.split('\n')[0]).replace(/libsql:\/\/[^\s'"`)]+/g, 'libsql://<redacted>');
}

console.log(`=== DATA MIGRATION ${APPLY ? 'APPLY' : 'DRY-RUN (no writes)'} ===`);

const tables = await run(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'app_%' ORDER BY name`);
const have = (n: string) => (tables.rows ?? []).some((r) => String(r.name) === n);
for (const t of ['app_repair_requests', 'app_payments', 'app_invoices', 'app_final_invoices', 'app_invoice_payments']) {
  console.log(`  destination table ${t}: ${have(t) ? 'present' : 'MISSING'}`);
}
if (!have('app_repair_requests') || !have('app_payments')) {
  console.error('BLOCKER: destination schema not initialized (run migrate:hosted first). Aborting.');
  process.exit(1);
}

const payCols = await run(`PRAGMA table_info(app_payments)`);
const hasProvenance = (payCols.rows ?? []).some((r) => String(r.name) === 'provenance');
console.log(`  app_payments.provenance column: ${hasProvenance ? 'present' : 'absent'}`);

// ---------------------------------------------------------------------------
// 3. Smallest safe additive schema adjustment (guarded, idempotent)
// ---------------------------------------------------------------------------
if (!hasProvenance) {
  if (APPLY) {
    await run('ALTER TABLE app_payments ADD COLUMN provenance TEXT');
    console.log('  SCHEMA: added app_payments.provenance TEXT (additive, nullable)');
  } else {
    console.log('  SCHEMA (preview): would ALTER TABLE app_payments ADD COLUMN provenance TEXT');
  }
}

// ---------------------------------------------------------------------------
// 4. Data copy (INSERT OR IGNORE — idempotent on primary key)
// ---------------------------------------------------------------------------
function argRow(row: Record<string, unknown>, cols: string[]): Array<string | number | null> {
  return cols.map((c) => {
    const v = row[c];
    if (v === undefined || v === null) return null;
    return typeof v === 'number' ? v : String(v);
  });
}

let insertedLeads = 0, skippedLeads = 0;
for (const row of srcLeads) {
  const sql = `INSERT OR IGNORE INTO app_repair_requests (${LEAD_COLS.join(', ')}) VALUES (${LEAD_COLS.map(() => '?').join(', ')})`;
  if (APPLY) {
    const r = await client.execute({ sql, args: argRow(row, LEAD_COLS) });
    if (Number(r.rowsAffected) > 0) insertedLeads++; else skippedLeads++;
  }
}
let payAction = 'would insert';
if (APPLY) {
  const src = srcPay[0];
  const payArgs: Array<string | number | null> = [
    String(src.id), String(src.invoice_number), String(src.customer_name), String(src.customer_email),
    src.amount as number, 'USD', String(src.stripe_session_id), String(src.status), String(src.created_at), PROVENANCE,
  ];
  const sql = `INSERT OR IGNORE INTO app_payments (${PAY_COLS.join(', ')}, provenance) VALUES (${PAY_COLS.map(() => '?').join(', ')}, ?)`;
  const r = await client.execute({ sql, args: payArgs });
  payAction = Number(r.rowsAffected) > 0 ? 'inserted' : 'already present (skipped)';
}
console.log(`  leads: ${srcLeads.length} to copy → ${APPLY ? `${insertedLeads} inserted, ${skippedLeads} skipped (idempotent)` : 'preview'}`);
console.log(`  legacy payment id=1 → ${APPLY ? payAction : 'preview'}`);

// ---------------------------------------------------------------------------
// 5. Reconciliation (read-only)
// ---------------------------------------------------------------------------
console.log('\n=== RECONCILIATION ===');

const dstLeads = (await run('SELECT * FROM app_repair_requests WHERE id IN (1,2,6) ORDER BY id')).rows;
const paySel = hasProvenance ? '*' : 'id, invoice_number, customer_name, customer_email, amount, currency, stripe_session_id, status, created_at';
const dstPayRows = (await run(`SELECT ${paySel} FROM app_payments WHERE id = 1`)).rows;

// full-row equality (field names only on mismatch, never values)
function diffFields(a: Record<string, unknown>, b: Record<string, unknown>, cols: string[]): string[] {
  return cols.filter((c) => String(a[c] ?? '') !== String(b[c] ?? ''));
}
for (const s of srcLeads) {
  const d = dstLeads.find((r) => Number(r.id) === Number(s.id));
  if (!d) { console.log(`  LEAD ${s.id}: MISSING on destination`); continue; }
  const diffs = diffFields(s, d as Record<string, unknown>, LEAD_COLS);
  console.log(`  LEAD ${s.id}: ${diffs.length === 0 ? 'MATCH' : `DIFF fields: ${diffs.join(', ')}`} | status=${String(d.status)} | created=${String(d.created_at)}`);
}
const dPay = dstPayRows[0] as Record<string, unknown> | undefined;
if (!dPay) {
  console.log('  PAYMENT id=1: MISSING on destination');
} else {
  const sPay = srcPay[0];
  const payDiffs = diffFields(sPay, dPay, PAY_COLS.filter((c) => c !== 'currency'));
  const currencyOk = String(dPay.currency) === 'USD';
  const sessionOk = String(sPay.stripe_session_id) === String(dPay.stripe_session_id);
  const provOk = !hasProvenance || String(dPay.provenance) === PROVENANCE;
  console.log(`  PAYMENT id=1: fields ${payDiffs.length === 0 ? 'MATCH' : `DIFF: ${payDiffs.join(', ')}`} | currency=USD(${currencyOk ? 'mapped' : 'FAIL'}) | stripe_session_id match=${sessionOk} | provenance=${provOk ? 'OK' : 'FAIL'} | status=${String(dPay.status)} | amount=${String(dPay.amount)} | created=${String(dPay.created_at)}`);
}

// counts + no-duplicate + invoice invariants
const counts: Record<string, number> = {};
for (const t of ['app_repair_requests', 'app_payments', 'app_invoices', 'app_invoice_payments', 'app_invoice_events', 'app_invoice_notifications', 'app_final_invoices', 'app_lead_activities', 'app_activity_log', 'app_notifications', 'app_schedule_notifications']) {
  const c = await run(`SELECT COUNT(*) AS n, COUNT(DISTINCT id) AS d FROM ${t}`);
  counts[t] = Number(c.rows[0]?.n ?? 0);
  const dups = Number(c.rows[0]?.d ?? 0) !== Number(c.rows[0]?.n ?? 0);
  if (dups && (t === 'app_repair_requests' || t === 'app_payments')) console.log(`  DUP CHECK ${t}: FAIL (count=${counts[t]}, distinct=${c.rows[0]?.d})`);
}
console.log(`  destination counts: ${Object.entries(counts).map(([t, n]) => `${t}=${n}`).join(', ')}`);
console.log(`  invoice ledger (HCSC) untouched: app_invoices=${counts.app_invoices} app_final_invoices=${counts.app_final_invoices} app_invoice_payments=${counts.app_invoice_payments} (sequence unchanged — no rows created)`);

// source counts for comparison
const srcCounts: Record<string, number> = {};
for (const t of ['app_repair_requests', 'app_payments']) {
  srcCounts[t] = Number(srcRows(`SELECT COUNT(*) AS n FROM ${t}`)[0]?.n ?? 0);
}
console.log(`  source counts:  app_repair_requests=${srcCounts.app_repair_requests} app_payments=${srcCounts.app_payments}`);
console.log(`  lead count match: ${counts.app_repair_requests === srcCounts.app_repair_requests ? 'YES' : 'NO'} | payment count match: ${counts.app_payments === srcCounts.app_payments ? 'YES' : 'NO'}`);

client.close();
console.log(`\n=== DONE (${APPLY ? 'applied' : 'dry-run, no writes'}) ===`);

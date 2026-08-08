#!/usr/bin/env node
/**
 * Regression suite for the Hill Country Appliance Repair admin lead-detail
 * workflow: scheduling controls + final invoice stage.
 *
 * Safety:
 *  - The server is started with EMAIL_DRY_RUN=true → every email action is
 *    recorded as dry_run and NEVER delivered to a real customer.
 *  - A throwaway QA lead (qa@test.local) is created and fully removed after
 *    the run — no production data is touched beyond the fixtures it creates.
 *  - No real payments are initiated; payment recording is simulated.
 *
 * Usage: node scripts/regression.mjs [port]
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const PORT = Number(process.argv[2] || 3100);
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = 'hc-admin-dev-token-2026';
const ROOT = path.resolve(import.meta.dirname ?? '.', '..');

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  ✔ ${name}`);
  } else {
    fail++;
    failures.push(`${name}${extra ? ` — ${extra}` : ''}`);
    console.log(`  ✘ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

function db(sql) {
  try {
    const out = execSync(`team-db "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' });
    return JSON.parse(out);
  } catch (e) {
    throw new Error(`team-db failed: ${e.message}`);
  }
}

async function api(pathname, { method = 'GET', body, expect = 200 } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/api/admin/data`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(1000);
  }
  return false;
}

async function main() {
  console.log(`\nHill Country lead-detail regression — port ${PORT}\n`);

  if (!existsSync(path.join(ROOT, '.next'))) {
    console.error('No .next build found. Run `npm run build` first.');
    process.exit(2);
  }

  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, EMAIL_DRY_RUN: 'true', NODE_ENV: 'production' },
    stdio: 'ignore',
  });

  const up = await waitForServer();
  if (!up) {
    console.error('Server did not start in time.');
    server.kill();
    process.exit(2);
  }
  console.log('Server up.\n');

  let qaId = null;

  try {
    /* ---------------- fixture ---------------- */
    const created = db(
      `INSERT INTO app_repair_requests (name, email, phone, address, appliance_type, brand, model, description, status) VALUES ('QA Regression Lead', 'qa@test.local', '555-0100', '123 Test Ln, Fredericksburg TX', 'Refrigerator', 'Samsung', 'RF28', 'Not cooling', 'pending') RETURNING id`
    );
    qaId = created[0].id;
    const leadPath = `/api/admin/lead/${qaId}`;
    ok('QA lead created', Number.isInteger(qaId));

    /* ---------------- detail GET ---------------- */
    let r = await api(leadPath);
    ok('GET detail returns lead', r.status === 200 && r.json.lead?.id === qaId);
    ok('detail includes empty invoice + payments arrays', Array.isArray(r.json.invoicePayments) && r.json.invoice === null);

    /* ---------------- schedule stage ---------------- */
    r = await api(leadPath, { method: 'PATCH', body: { status: 'scheduled' } });
    ok('PATCH status → scheduled', r.status === 200 && r.json.lead?.status === 'scheduled');

    r = await api(leadPath, { method: 'PATCH', body: { scheduled_date: '2026-08-20', scheduled_time: '8:00 AM' } });
    ok('PATCH save schedule', r.status === 200 && r.json.lead?.scheduled_date === '2026-08-20');

    r = await api(leadPath, { method: 'PATCH', body: { scheduled_date: 'not-a-date' } });
    ok('PATCH rejects bad date', r.status === 400);

    r = await api(`${leadPath}/notify`, { method: 'POST', body: { type: 'updated_schedule' } });
    ok('updated-schedule notice blocked before confirmation', r.status === 400);

    r = await api(`${leadPath}/notify`, { method: 'POST', body: { type: 'confirmation' } });
    ok('confirmation → dry run (EMAIL_DRY_RUN=true)', r.status === 200 && r.json.dryRun === true);

    r = await api(`${leadPath}/notify`, { method: 'POST', body: { type: 'confirmation' } });
    ok('confirmation resend allowed (re-confirm)', r.status === 200 && r.json.dryRun === true);

    /* ---------------- completion must NOT auto-invoice ---------------- */
    r = await api(leadPath, { method: 'PATCH', body: { status: 'completed' } });
    ok('PATCH status → completed', r.status === 200 && r.json.lead?.status === 'completed');

    r = await api(leadPath);
    ok('completing did NOT auto-generate an invoice', r.json.invoice === null);

    /* ---------------- invoice stage ---------------- */
    r = await api(`${leadPath}/invoice`, { method: 'POST', body: { action: 'generate', amountCents: 15000, paymentMethods: ['stripe', 'paypal'], dueDate: '2026-09-01' } });
    ok('invoice generate → draft', r.status === 200 && r.json.invoice?.status === 'draft' && r.json.invoice?.amount_cents === 15000);
    const invoiceNumber = r.json.invoice?.invoice_number;
    ok('invoice number issued', typeof invoiceNumber === 'string' && /^INV-\d{4}-\d{3}$/.test(invoiceNumber));
    ok('payment links generated', r.json.invoice?.pay_link_stripe?.includes('invoice=') && r.json.invoice?.pay_link_paypal?.includes('invoice='));

    r = await api(`${leadPath}/invoice`, { method: 'POST', body: { action: 'generate', amountCents: 10000, paymentMethods: ['stripe'] } });
    ok('duplicate generate rejected', r.status === 400);

    r = await api(`${leadPath}/invoice`, { method: 'POST', body: { action: 'preview' } });
    ok('invoice preview renders (no send)', r.status === 200 && r.json.preview?.subject.includes(invoiceNumber));

    r = await api(`${leadPath}/invoice`, { method: 'POST', body: { action: 'send' } });
    ok('invoice send → dry run, status final_invoice_sent', r.status === 200 && r.json.dryRun === true && r.json.invoice?.status === 'final_invoice_sent');

    /* partial payment + mark-paid safeguards */
    r = await api(`${leadPath}/invoice`, { method: 'POST', body: { action: 'record_payment', amountCents: 5000, method: 'stripe', reference: 'txn_partial_1' } });
    ok('record partial payment keeps final_invoice_sent', r.status === 200 && r.json.invoice?.status === 'final_invoice_sent' && r.json.balanceCents === 10000);

    r = await api(`${leadPath}/invoice`, { method: 'POST', body: { action: 'mark_paid', ledgerReference: 'ref-1' } });
    ok('mark paid blocked WITHOUT ledger confirmation', r.status === 400);

    r = await api(`${leadPath}/invoice`, { method: 'POST', body: { action: 'mark_paid', ledgerConfirmed: true, ledgerReference: 'ref-1' } });
    ok('mark paid blocked while balance outstanding', r.status === 400);

    r = await api(`${leadPath}/invoice`, { method: 'POST', body: { action: 'record_payment', amountCents: 10000, method: 'paypal', reference: 'txn_full_2' } });
    ok('record remaining payment', r.status === 200 && r.json.balanceCents === 0);

    r = await api(leadPath);
    ok('invoice NOT auto-paid by recorded payments', r.json.invoice?.status !== 'invoice_paid');

    r = await api(`${leadPath}/invoice`, { method: 'POST', body: { action: 'mark_paid', ledgerConfirmed: true, ledgerReference: 'pi_3MockLedgerRef' } });
    ok('mark paid AFTER ledger confirmation → invoice_paid', r.status === 200 && r.json.invoice?.status === 'invoice_paid' && r.json.balanceCents === 0);
    ok('payments confirmed in ledger', (r.json.payments ?? []).every((p) => p.ledger_confirmed === 1));

    r = await api(`${leadPath}/invoice`, { method: 'POST', body: { action: 'record_payment', amountCents: 100, method: 'manual' } });
    ok('record payment blocked after paid', r.status === 400);

    r = await api(`${leadPath}/invoice`, { method: 'POST', body: { action: 'receipt' } });
    ok('receipt send → dry run', r.status === 200 && r.json.dryRun === true);

    r = await api(`${leadPath}/invoice`, { method: 'POST', body: { action: 'update_methods', paymentMethods: ['stripe'] } });
    ok('payment methods update', r.status === 200 && r.json.invoice?.payment_methods === 'stripe');

    /* ---------------- detail consistency ---------------- */
    r = await api(leadPath);
    ok('detail includes final_invoice notification (dry run)', (r.json.notifications ?? []).some((n) => n.type === 'final_invoice' && n.status === 'dry_run'));
    ok('detail includes receipt notification (dry run)', (r.json.notifications ?? []).some((n) => n.type === 'receipt' && n.status === 'dry_run'));
    ok('detail includes invoice_generated activity', (r.json.activities ?? []).some((a) => a.action === 'invoice_generated'));
    ok('detail includes invoice_paid activity', (r.json.activities ?? []).some((a) => a.action === 'invoice_paid'));
    ok('detail includes confirmation dry-run activity', (r.json.activities ?? []).some((a) => a.action === 'email_dry_run'));
    ok('invoice paid status persisted', r.json.invoice?.status === 'invoice_paid');

    /* ---------------- untouched legacy workflows ---------------- */
    const payments = db('SELECT COUNT(*) AS n FROM app_payments');
    ok('legacy app_payments untouched (no rows added)', Number(payments[0].n) === 1);
    const originalRequests = db(`SELECT COUNT(*) AS n FROM app_repair_requests WHERE id NOT IN (SELECT id FROM app_repair_requests WHERE email='qa@test.local')`);
    ok('existing requests preserved', Number(originalRequests[0].n) >= 2);

    console.log(`\n${pass} passed, ${fail} failed`);
    if (fail > 0) {
      console.log('\nFailures:');
      failures.forEach((f) => console.log(`  - ${f}`));
    }
  } catch (e) {
    fail++;
    failures.push(`uncaught: ${e.message}`);
    console.error('Regression error:', e);
    console.log(`\n${pass} passed, ${fail} failed`);
  } finally {
    /* cleanup QA fixtures */
    if (qaId != null) {
      try {
        db(`DELETE FROM app_lead_activities WHERE request_id = ${qaId}`);
        db(`DELETE FROM app_schedule_notifications WHERE request_id = ${qaId}`);
        db(`DELETE FROM app_notifications WHERE request_id = ${qaId}`);
        db(`DELETE FROM app_activity_log WHERE request_id = ${qaId}`);
        db(`DELETE FROM app_invoice_payments WHERE request_id = ${qaId}`);
        db(`DELETE FROM app_final_invoices WHERE request_id = ${qaId}`);
        db(`DELETE FROM app_repair_requests WHERE id = ${qaId}`);
        console.log('\nQA fixtures cleaned up.');
      } catch (e) {
        console.error('Cleanup failed:', e.message);
      }
    }
    server.kill();
  }

  process.exit(fail > 0 ? 1 : 0);
}

main();

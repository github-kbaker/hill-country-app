/**
 * Hosted-database schema migration (Turso / libsql).
 *
 * Run against the PRODUCTION database before first deploy:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... bun scripts/migrate-hosted.ts
 * or explicitly:
 *   bun scripts/migrate-hosted.ts --url libsql://... --token <auth-token>
 * Local/testing:
 *   bun scripts/migrate-hosted.ts --url file:./data/app.db
 *
 * Fully idempotent (safe to re-run): every statement is CREATE ... IF NOT
 * EXISTS and applied migrations are tracked in app_schema_migrations. This is
 * the authoritative app schema — the same 11 app_* tables the dev team-db
 * database carries, plus supporting indexes and a UNIQUE backstop on
 * provider_event_id so concurrent webhook deliveries can never double-apply a
 * payment even if two requests race the code-level idempotency check.
 */

import { createClient, type Client } from '@libsql/client';

const MIGRATION_VERSION = '0001_full_app_schema';

const SCHEMA: string[] = [
  // -- lead/schedule domain --------------------------------------------------
  `CREATE TABLE IF NOT EXISTS app_repair_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, email TEXT, phone TEXT, address TEXT,
    appliance_type TEXT, brand TEXT, model TEXT, description TEXT,
    preferred_date TEXT, preferred_time TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    scheduled_date TEXT, scheduled_time TEXT,
    cancelled_at DATETIME,
    appointment_start TEXT, appointment_end TEXT,
    appointment_local_start TEXT, appointment_local_end TEXT,
    appointment_tz TEXT DEFAULT 'America/Chicago',
    duration_minutes INTEGER DEFAULT 120,
    confirmed_at DATETIME, cancel_reason TEXT, updated_at DATETIME
  )`,
  `CREATE TABLE IF NOT EXISTS app_lead_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS app_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    detail TEXT,
    actor TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS app_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    "type" TEXT NOT NULL CHECK ("type" IN ('confirmation', 'update', 'cancellation')),
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 1,
    error TEXT,
    message_id TEXT,
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS app_schedule_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    recipient_email TEXT,
    status TEXT DEFAULT 'pending',
    error TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // -- legacy payment record (preserved unchanged) ---------------------------
  `CREATE TABLE IF NOT EXISTS app_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT,
    customer_name TEXT,
    customer_email TEXT,
    amount INTEGER,
    currency TEXT,
    stripe_session_id TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // -- canonical invoice ledger ----------------------------------------------
  `CREATE TABLE IF NOT EXISTS app_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER,
    invoice_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'draft',
    subtotal_cents INTEGER NOT NULL,
    discount_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL,
    paid_cents INTEGER NOT NULL DEFAULT 0,
    balance_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    due_date TEXT,
    payment_methods TEXT NOT NULL DEFAULT 'stripe,paypal,manual',
    payout_status TEXT NOT NULL DEFAULT 'on_hold',
    discount_reason TEXT,
    customer_name TEXT,
    customer_email TEXT,
    sent_at TEXT,
    paid_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_invoice_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    request_id INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    method TEXT NOT NULL,
    reference TEXT,
    status TEXT NOT NULL DEFAULT 'recorded',
    ledger_confirmed INTEGER NOT NULL DEFAULT 0,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME,
    provider TEXT,
    provider_event_id TEXT,
    provider_reference TEXT,
    payment_method TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    customer_email TEXT,
    customer_name TEXT,
    note TEXT,
    created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS app_invoice_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    event_key TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    provider TEXT,
    detail TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_invoice_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    subject TEXT,
    status TEXT NOT NULL,
    message_id TEXT,
    error TEXT,
    created_at TEXT NOT NULL
  )`,

  // -- UI projection (synced from the canonical ledger, never a numbering
  //    source; invoice_number UNIQUE so a projection can never diverge) ------
  `CREATE TABLE IF NOT EXISTS app_final_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    payment_methods TEXT NOT NULL DEFAULT 'stripe',
    currency TEXT NOT NULL DEFAULT 'usd',
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    due_date TEXT,
    pay_link_stripe TEXT,
    pay_link_paypal TEXT,
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // -- migration tracking ------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS app_schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`,
];

const INDEXES: string[] = [
  // Concurrency backstop: webhook redeliveries / double-clicks can never
  // double-apply a payment (NULLs may repeat; SQLite allows multiple NULLs).
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_payments_provider_event_id ON app_invoice_payments (provider_event_id)`,
  `CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON app_invoice_payments (invoice_id)`,
  `CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice_id ON app_invoice_events (invoice_id)`,
  `CREATE INDEX IF NOT EXISTS idx_invoice_notifications_invoice_id ON app_invoice_notifications (invoice_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_activities_request_id ON app_lead_activities (request_id)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_log_request_id ON app_activity_log (request_id)`,
  `CREATE INDEX IF NOT EXISTS idx_repair_requests_status ON app_repair_requests (status)`,
  `CREATE INDEX IF NOT EXISTS idx_final_invoices_request_id ON app_final_invoices (request_id)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_status ON app_invoices (status)`,
  `CREATE INDEX IF NOT EXISTS idx_schedule_notifications_request_id ON app_schedule_notifications (request_id)`,
];

function parseArgs(argv: string[]): { url?: string; token?: string; verifyOnly?: boolean } {
  const out: { url?: string; token?: string; verifyOnly?: boolean } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') out.url = argv[++i];
    else if (argv[i] === '--token') out.token = argv[++i];
    else if (argv[i] === '--verify') out.verifyOnly = true;
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url ?? process.env.TURSO_DATABASE_URL;
  const token = args.token ?? process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error('No database URL: pass --url <libsql-url> or set TURSO_DATABASE_URL.');
    process.exit(1);
  }

  const client: Client = createClient({ url, authToken: token || undefined });
  const tableNames = [
    'app_repair_requests', 'app_lead_activities', 'app_activity_log',
    'app_notifications', 'app_schedule_notifications', 'app_payments',
    'app_invoices', 'app_invoice_payments', 'app_invoice_events',
    'app_invoice_notifications', 'app_final_invoices', 'app_schema_migrations',
  ];

  try {
    if (args.verifyOnly) {
      await verify(client, tableNames);
      return;
    }

    console.log(`Migrating hosted schema → ${url.split('?')[0]} (version ${MIGRATION_VERSION})`);
    await applyMigration(client);
    await verify(client, tableNames);
    console.log('Migration complete.');
  } catch (err) {
    console.error(`Migration aborted: ${(err as Error).message}`);
    process.exit(1);
  } finally {
    client.close();
  }
}

/** Apply the full schema + indexes idempotently (exported for tests). */
export async function applyMigration(client: Client): Promise<void> {
  const statements = [...SCHEMA, ...INDEXES];
  let failures = 0;
  for (const sql of statements) {
    try {
      await client.execute(sql);
      console.log(`  OK: ${sql.slice(0, 80).replace(/\s+/g, ' ')}${sql.length > 80 ? '…' : ''}`);
    } catch (err) {
      failures++;
      console.error(`  FAILED: ${sql.replace(/\s+/g, ' ').slice(0, 120)}\n    ${(err as Error).message.split('\n')[0]}`);
    }
  }
  if (failures > 0) {
    throw new Error(`Migration finished with ${failures} failed statement(s).`);
  }
  await client.execute(
    `INSERT OR IGNORE INTO app_schema_migrations (version, applied_at) VALUES ('${MIGRATION_VERSION}', datetime('now'))`,
  );
}

async function verify(client: Client, tableNames: string[]): Promise<void> {
  console.log('--- verification ---');
  for (const name of tableNames) {
    try {
      const rs = await client.execute(`SELECT COUNT(*) AS n FROM ${name}`);
      console.log(`  ${name}: ${rs.rows[0]?.n ?? 0} row(s)`);
    } catch {
      console.error(`  ${name}: MISSING`);
    }
  }
  const idx = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='index' AND name='uq_invoice_payments_provider_event_id'`,
  );
  console.log(`  uq_invoice_payments_provider_event_id: ${idx.rows.length ? 'present' : 'MISSING'}`);
  const mig = await client.execute(`SELECT version FROM app_schema_migrations ORDER BY version`);
  console.log(`  migrations: ${mig.rows.map((r) => String(r.version)).join(', ') || '(none)'}`);
}

// Run only when invoked directly (so tests can import SCHEMA/INDEXES/applyMigration).
if (process.argv[1]?.endsWith('migrate-hosted.ts')) {
  main();
}

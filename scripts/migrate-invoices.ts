/**
 * Idempotent schema migration for the final-invoice ledger.
 * Run:  bun scripts/migrate.ts   (uses the team-db CLI like the rest of the app)
 *
 * Adds (never removes / rewrites existing data):
 *   app_invoices            — canonical final invoice rows
 *   app_invoice_payments    — canonical payment ledger (stripe | paypal | manual)
 *   app_invoice_events      — idempotency/event tracking (event_key UNIQUE)
 *   app_invoice_notifications — separate invoice notification tracking
 */
import { execSync } from 'node:child_process';

function run(sql: string): void {
  const command = `team-db "${sql.replace(/\"/g, '\\"')}"`;
  try {
    execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`  OK: ${sql.slice(0, 90)}${sql.length > 90 ? '…' : ''}`);
  } catch (err) {
    console.error(`  FAILED: ${sql}\n  ${(err as Error).message.split('\n')[0]}`);
  }
}

function hasTable(name: string): boolean {
  const out = execSync(`team-db "SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'"`, { encoding: 'utf-8' });
  return out.includes(`"${name}"`);
}

function hasColumn(table: string, column: string): boolean {
  const out = execSync(`team-db "PRAGMA table_info(${table})"`, { encoding: 'utf-8' });
  return out.includes(`"name": "${column}"`);
}

function hasIndex(table: string, indexName: string): boolean {
  const out = execSync(`team-db "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='${table}' AND name='${indexName}'"`, { encoding: 'utf-8' });
  return out.includes(`"${indexName}"`);
}

console.log('Migrating invoice ledger schema…');

// app_invoices ---------------------------------------------------------------
if (!hasTable('app_invoices')) {
  run(`CREATE TABLE app_invoices (
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
  )`);
  run('CREATE INDEX idx_invoices_request ON app_invoices(request_id)');
  run('CREATE INDEX idx_invoices_status ON app_invoices(status)');
} else {
  console.log('  SKIP: app_invoices exists');
}
if (hasTable('app_invoices') && !hasColumn('app_invoices', 'customer_name')) {
  run("ALTER TABLE app_invoices ADD COLUMN customer_name TEXT");
}
if (hasTable('app_invoices') && !hasColumn('app_invoices', 'customer_email')) {
  run("ALTER TABLE app_invoices ADD COLUMN customer_email TEXT");
}

// app_invoice_payments ---------------------------------------------------------
// Coexists with the frontend agent's table (method/reference/ledger_confirmed/
// recorded_at/confirmed_at/request_id). The canonical ledger columns below are
// ADDED when missing so one table serves both the UI reads and the ledger.
const paymentsColumns: Array<[string, string]> = [
  ['provider', "TEXT"],
  ['provider_event_id', "TEXT"],
  ['provider_reference', "TEXT"],
  ['payment_method', "TEXT"],
  ['currency', "TEXT NOT NULL DEFAULT 'USD'"],
  ['customer_email', "TEXT"],
  ['customer_name', "TEXT"],
  ['note', "TEXT"],
  ['created_at', "TEXT"],
];
if (!hasTable('app_invoice_payments')) {
  run(`CREATE TABLE app_invoice_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    request_id INTEGER,
    amount_cents INTEGER NOT NULL,
    method TEXT,
    reference TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    ledger_confirmed INTEGER NOT NULL DEFAULT 0,
    recorded_at TEXT,
    confirmed_at TEXT,
    provider TEXT,
    provider_event_id TEXT,
    provider_reference TEXT,
    payment_method TEXT,
    customer_email TEXT,
    customer_name TEXT,
    note TEXT,
    created_at TEXT
  )`);
} else {
  console.log('  EXISTS: app_invoice_payments (frontend agent) — adding canonical columns');
  for (const [col, type] of paymentsColumns) {
    if (!hasColumn('app_invoice_payments', col)) {
      run(`ALTER TABLE app_invoice_payments ADD COLUMN ${col} ${type}`);
    }
  }
}
if (!hasIndex('app_invoice_payments', 'idx_invoice_payments_event')) {
  run('CREATE UNIQUE INDEX idx_invoice_payments_event ON app_invoice_payments(provider_event_id)');
}
run('CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON app_invoice_payments(invoice_id)');
run('CREATE INDEX IF NOT EXISTS idx_invoice_payments_request ON app_invoice_payments(request_id)');

// app_invoice_events ------------------------------------------------------------
if (!hasTable('app_invoice_events')) {
  run(`CREATE TABLE app_invoice_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    event_key TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    provider TEXT,
    detail TEXT,
    created_at TEXT NOT NULL
  )`);
  run('CREATE INDEX idx_invoice_events_invoice ON app_invoice_events(invoice_id)');
} else {
  console.log('  SKIP: app_invoice_events exists');
}

// app_invoice_notifications -----------------------------------------------------
if (!hasTable('app_invoice_notifications')) {
  run(`CREATE TABLE app_invoice_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    subject TEXT,
    status TEXT NOT NULL,
    message_id TEXT,
    error TEXT,
    created_at TEXT NOT NULL
  )`);
  run('CREATE INDEX idx_invoice_notifs_invoice ON app_invoice_notifications(invoice_id)');
} else {
  console.log('  SKIP: app_invoice_notifications exists');
}

console.log('Migration complete.');

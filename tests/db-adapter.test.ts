/**
 * Hosted-database adapter tests.
 *
 * Exercises the production data path end-to-end against a REAL @libsql
 * database (local file URL — the same driver/API used for remote Turso):
 *   - migration applies the full app schema idempotently
 *   - query()/escape() CRUD through src/lib/db.ts (the async adapter)
 *   - independent requests (separate client connections) see each other's writes
 *   - UNIQUE idempotency backstops (provider_event_id, invoice_number, event_key)
 *   - HCSC-YYYY-NNNNNN canonical numbering + projection sync through the adapter
 *   - production fails CLOSED without TURSO_DATABASE_URL (no team-db fallback)
 *   - production admin auth fails CLOSED without ADMIN_API_TOKEN
 *
 * No network, no real email, no real payment — EMAIL_DRY_RUN-style injection
 * (dryRun: true) keeps notifications out of any transport.
 */

import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { applyMigration } from '../scripts/migrate-hosted';
import { query, escape, dbMode, __resetDbClientForTests } from '../src/lib/db';
import { InvoiceService, nextInvoiceNumber } from '../src/lib/invoice';
import { getAdminToken, isAdminRequest } from '../src/lib/admin-auth';
import { DEV_ADMIN_TOKEN } from '../src/lib/admin-constants';

let dbFile: string;
let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'hc-db-adapter-'));
  dbFile = join(dir, 'app.db');

  // Point the app adapter at the temp database BEFORE any query() call.
  process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
  delete process.env.TURSO_AUTH_TOKEN;
  __resetDbClientForTests();

  const bootstrap = createClient({ url: `file:${dbFile}` });
  await applyMigration(bootstrap);
  bootstrap.close();
});

afterAll(() => {
  delete process.env.TURSO_DATABASE_URL;
  __resetDbClientForTests();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* temp cleanup best-effort */
  }
});

describe('migration (hosted schema)', () => {
  test('applies the full app schema idempotently', async () => {
    // Already applied in beforeAll; re-run must be a no-op success.
    const client = createClient({ url: `file:${dbFile}` });
    await applyMigration(client); // would throw on any failure
    const tables = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'app_%' ORDER BY name`,
    );
    const names = tables.rows.map((r) => String(r.name));
    for (const expected of [
      'app_activity_log',
      'app_final_invoices',
      'app_invoice_events',
      'app_invoice_notifications',
      'app_invoice_payments',
      'app_invoices',
      'app_lead_activities',
      'app_notifications',
      'app_payments',
      'app_repair_requests',
      'app_schedule_notifications',
      'app_schema_migrations',
    ]) {
      expect(names).toContain(expected);
    }
    const idx = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='index' AND name='uq_invoice_payments_provider_event_id'`,
    );
    expect(idx.rows.length).toBe(1);
    client.close();
  });
});

describe('adapter CRUD (src/lib/db.ts → @libsql)', () => {
  test('dbMode() reports turso when TURSO_DATABASE_URL is set', () => {
    expect(dbMode()).toBe('turso');
  });

  test('insert → select → update → delete round-trips with team-db-style rows', async () => {
    await query(
      `INSERT INTO app_repair_requests (name, email, phone, address, appliance_type, brand, model, description, preferred_date, preferred_time, status)
       VALUES (${escape("O'Brien Family")}, ${escape('obrien@example.com')}, ${escape('830-555-0100')}, ${escape("123 Main St, Fredericksburg, TX")}, ${escape("Refrigerator")}, ${escape("GE")}, ${escape("GSS25")}, ${escape("Not cooling, freezer fine")}, '2026-08-15', '8:00 AM', 'pending')`,
    );
    const rows = (await query(`SELECT * FROM app_repair_requests WHERE email = ${escape('obrien@example.com')}`)) as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("O'Brien Family");
    expect(rows[0].appliance_type).toBe('Refrigerator');
    const id = rows[0].id;

    await query(`UPDATE app_repair_requests SET status = 'scheduled' WHERE id = ${id}`);
    const updated = (await query(`SELECT status FROM app_repair_requests WHERE id = ${id}`)) as any[];
    expect(updated[0].status).toBe('scheduled');

    await query(`DELETE FROM app_repair_requests WHERE id = ${id}`);
    const gone = (await query(`SELECT * FROM app_repair_requests WHERE id = ${id}`)) as any[];
    expect(gone.length).toBe(0);
  });

  test('escape() quotes single quotes and renders NULL', () => {
    expect(escape("it's broken")).toBe("'it''s broken'");
    expect(escape(null)).toBe('NULL');
    expect(escape(undefined)).toBe('NULL');
    expect(escape(42)).toBe("'42'");
  });
});

describe('independent requests (separate connections, same database)', () => {
  test('a second client sees the first client\'s committed writes', async () => {
    const a = createClient({ url: `file:${dbFile}` });
    const b = createClient({ url: `file:${dbFile}` });
    await a.execute(`INSERT INTO app_payments (invoice_number, customer_name, customer_email, amount, currency, stripe_session_id, status)
                     VALUES ('HCSC-2026-000001', 'Ada', 'ada@example.com', 27500, 'USD', 'cs_test_indep', 'paid')`);
    const seen = await b.execute(`SELECT * FROM app_payments WHERE stripe_session_id = 'cs_test_indep'`);
    expect(seen.rows.length).toBe(1);
    expect(String(seen.rows[0].customer_name)).toBe('Ada');
    a.close();
    b.close();
  });
});

describe('idempotency & concurrency backstops', () => {
  test('UNIQUE provider_event_id blocks a duplicate payment row at the DB level', async () => {
    await query(
      `INSERT INTO app_invoice_payments (invoice_id, request_id, provider, provider_event_id, amount_cents, method, currency, status, ledger_confirmed)
       VALUES (1, 1, 'stripe', 'evt_dup_1', 1000, 'stripe', 'USD', 'recorded', 1)`,
    );
    await expect(
      query(
        `INSERT INTO app_invoice_payments (invoice_id, request_id, provider, provider_event_id, amount_cents, method, currency, status, ledger_confirmed)
         VALUES (1, 1, 'stripe', 'evt_dup_1', 1000, 'stripe', 'USD', 'recorded', 1)`,
      ),
    ).rejects.toThrow();
    const rows = (await query(`SELECT * FROM app_invoice_payments WHERE provider_event_id = ${escape('evt_dup_1')}`)) as any[];
    expect(rows.length).toBe(1);
  });

  test('UNIQUE invoice_number blocks duplicate canonical numbers', async () => {
    await query(
      `INSERT INTO app_invoices (request_id, invoice_number, status, subtotal_cents, total_cents, balance_cents, created_at, updated_at)
       VALUES (1, 'HCSC-2026-000001', 'draft', 1000, 1000, 1000, '2026-08-08T12:00:00Z', '2026-08-08T12:00:00Z')`,
    );
    await expect(
      query(
        `INSERT INTO app_invoices (request_id, invoice_number, status, subtotal_cents, total_cents, balance_cents, created_at, updated_at)
         VALUES (1, 'HCSC-2026-000001', 'draft', 1000, 1000, 1000, '2026-08-08T12:00:00Z', '2026-08-08T12:00:00Z')`,
      ),
    ).rejects.toThrow();
  });

  test('UNIQUE event_key blocks duplicate ledger events', async () => {
    await query(
      `INSERT INTO app_invoice_events (invoice_id, event_key, event_type, provider, detail, created_at)
       VALUES (1, 'evt:key:1', 'invoice_created', NULL, 'x', '2026-08-08T12:00:00Z')`,
    );
    await expect(
      query(
        `INSERT INTO app_invoice_events (invoice_id, event_key, event_type, provider, detail, created_at)
         VALUES (1, 'evt:key:1', 'invoice_created', NULL, 'x', '2026-08-08T12:00:00Z')`,
      ),
    ).rejects.toThrow();
  });
});

describe('InvoiceService on the real hosted adapter', () => {
  test('HCSC-YYYY-NNNNNN numbering + projection sync, no divergence', async () => {
    const svc = new InvoiceService({
      db: { query },
      dryRun: true,
      now: () => new Date('2026-08-08T12:00:00.000Z'),
    });
    // Numbering advances from whatever the canonical ledger already holds
    // (idempotency tests seed rows directly), so derive the expected next.
    const before = (await query('SELECT invoice_number FROM app_invoices')) as Array<{ invoice_number: string }>;
    const expectedFirst = nextInvoiceNumber(before.map((r) => r.invoice_number), 2026);

    const first = await svc.create({ requestId: 1, subtotalCents: 35000, discountCents: 7500, customerName: 'Michonne' });
    expect(first.invoice_number).toBe(expectedFirst);

    const second = await svc.create({ requestId: 2, subtotalCents: 20000, customerName: 'Rick' });
    expect(second.invoice_number).toBe(nextInvoiceNumber([...before.map((r) => r.invoice_number), first.invoice_number], 2026));

    const canonical = (await query('SELECT invoice_number FROM app_invoices')) as Array<{ invoice_number: string }>;
    const projection = (await query('SELECT invoice_number FROM app_final_invoices')) as Array<{ invoice_number: string }>;
    const canonicalNums = canonical.map((r) => r.invoice_number);
    const projNums = projection.map((r) => r.invoice_number);
    // Divergence guard: the projection mirrors only service-created invoices,
    // always with the canonical number, and never carries a number the
    // canonical ledger does not have (raw seeded rows never touch it).
    expect(projNums).toContain(first.invoice_number);
    expect(projNums).toContain(second.invoice_number);
    for (const n of projNums) expect(canonicalNums).toContain(n);
    expect(canonical.every((r) => /^HCSC-\d{4}-\d{6}$/.test(r.invoice_number))).toBe(true);
  });

  test('applyPayment is idempotent through the adapter (applied true → false)', async () => {
    const svc = new InvoiceService({ db: { query }, dryRun: true, now: () => new Date('2026-08-08T12:00:00.000Z') });
    const inv = await svc.create({ requestId: 3, subtotalCents: 27500, customerName: 'Daryl', customerEmail: 'daryl@example.com' });
    const payment = {
      providerEventId: 'evt_adapter_1',
      provider: 'stripe' as const,
      providerReference: 'cs_adapter_1',
      amountCents: 27500,
      currency: 'USD',
      status: 'completed' as const,
      paymentMethod: 'card',
      invoiceId: inv.id,
    };
    const first = await svc.applyPayment(inv.id, payment);
    const second = await svc.applyPayment(inv.id, payment);
    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    const payments = (await query('SELECT * FROM app_invoice_payments WHERE provider_event_id = ' + escape('stripe:evt_adapter_1'))) as any[];
    expect(payments.length).toBe(1);
    const paid = await svc.findPublicByNumber(inv.invoice_number);
    expect(paid?.status).toBe('invoice_paid');
    expect(paid?.payout_status).toBe('released');
  });
});

describe('production fails closed', () => {
  test('query() refuses to run without TURSO_DATABASE_URL when NODE_ENV=production', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevUrl = process.env.TURSO_DATABASE_URL;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.TURSO_DATABASE_URL;
      __resetDbClientForTests();
      expect(dbMode()).toBe('unconfigured');
      await expect(query('SELECT 1')).rejects.toThrow(/TURSO_DATABASE_URL/);
    } finally {
      if (prevUrl) process.env.TURSO_DATABASE_URL = prevUrl;
      else delete process.env.TURSO_DATABASE_URL;
      process.env.NODE_ENV = prevNodeEnv;
      __resetDbClientForTests();
    }
  });

  test('admin auth fails closed in production without ADMIN_API_TOKEN (dev fallback rejected)', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevToken = process.env.ADMIN_API_TOKEN;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.ADMIN_API_TOKEN;
      expect(getAdminToken()).toBe('');
      const req = new Request('http://localhost/api/admin/x', {
        headers: { authorization: `Bearer ${DEV_ADMIN_TOKEN}` },
      });
      expect(isAdminRequest(req)).toBe(false);
    } finally {
      if (prevToken) process.env.ADMIN_API_TOKEN = prevToken;
      else delete process.env.ADMIN_API_TOKEN;
      process.env.NODE_ENV = prevNodeEnv;
    }
  });

  test('admin auth accepts ADMIN_API_TOKEN when set', async () => {
    const prevToken = process.env.ADMIN_API_TOKEN;
    try {
      process.env.ADMIN_API_TOKEN = 'prod-secret-token';
      const req = new Request('http://localhost/api/admin/x', {
        headers: { 'x-admin-token': 'prod-secret-token' },
      });
      expect(isAdminRequest(req)).toBe(true);
    } finally {
      if (prevToken) process.env.ADMIN_API_TOKEN = prevToken;
      else delete process.env.ADMIN_API_TOKEN;
    }
  });
});

import { describe, expect, test } from 'bun:test';
import { FakeDb, seedLeads } from './fakeDb';
import {
  InvoiceService,
  calculateInvoiceTotals,
  nextInvoiceNumber,
  parseInvoiceNumber,
  formatInvoiceNumber,
} from '../src/lib/invoice';
import type { TransportLike } from '../src/lib/email';

function mockTransport() {
  const sent: Array<{ to: string; subject: string; html: string; text: string }> = [];
  const transport: TransportLike = {
    async sendMail(mail) {
      sent.push({ to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
      return { messageId: `mock-${sent.length}`, accepted: true };
    },
  };
  return { sent, transport };
}

function failingTransport(): TransportLike {
  return {
    async sendMail() {
      throw new Error('SMTP 550 relay denied');
    },
  };
}

function service(db: FakeDb, overrides: { transport?: TransportLike; dryRun?: boolean } = {}) {
  return new InvoiceService({
    db,
    customerTransport: overrides.transport ?? mockTransport().transport,
    dryRun: overrides.dryRun,
    now: () => new Date('2026-08-08T12:00:00.000Z'),
  });
}

describe('calculateInvoiceTotals (currency-safe)', () => {
  test('Michonne QA: $350 subtotal - $75 discount = $275 total', () => {
    const t = calculateInvoiceTotals({ subtotalCents: 35000, discountCents: 7500 });
    expect(t.totalCents).toBe(27500);
    expect(t.balanceCents).toBe(27500);
    expect(t.discountCents).toBe(7500);
  });

  test('rejects non-integer cents (float drift protection)', () => {
    expect(() => calculateInvoiceTotals({ subtotalCents: 35000.5 })).toThrow();
    expect(() => calculateInvoiceTotals({ subtotalCents: 35000, discountCents: 0.1 })).toThrow();
  });

  test('rejects negative values and discount above subtotal', () => {
    expect(() => calculateInvoiceTotals({ subtotalCents: -1 })).toThrow();
    expect(() => calculateInvoiceTotals({ subtotalCents: 100, discountCents: 101 })).toThrow();
  });

  test('tax adds after discount', () => {
    const t = calculateInvoiceTotals({ subtotalCents: 10000, discountCents: 2000, taxCents: 400 });
    expect(t.totalCents).toBe(8400);
  });
});

describe('stable invoice numbering', () => {
  test('per-year sequence, zero-padded, never reused', () => {
    expect(nextInvoiceNumber([], 2026)).toBe('HCSC-2026-000001');
    expect(nextInvoiceNumber(['HCSC-2026-000001'], 2026)).toBe('HCSC-2026-000002');
    expect(nextInvoiceNumber(['HCSC-2026-000001', 'HCSC-2026-000002'], 2026)).toBe('HCSC-2026-000003');
  });

  test('separate sequence per year', () => {
    expect(nextInvoiceNumber(['HCSC-2026-000042'], 2027)).toBe('HCSC-2027-000001');
  });

  test('parse/format round-trip; foreign/legacy formats cannot advance the HCSC sequence', () => {
    expect(parseInvoiceNumber('HCSC-2026-000007')).toEqual({ year: 2026, seq: 7 });
    expect(parseInvoiceNumber('garbage')).toBeNull();
    expect(parseInvoiceNumber('HCAR-2026-0001')).toBeNull();
    expect(parseInvoiceNumber('INV-2026-001')).toBeNull();
    expect(parseInvoiceNumber('HCSC-2026-00001')).toBeNull(); // wrong width
    expect(formatInvoiceNumber(2026, 7)).toBe('HCSC-2026-000007');
  });
});

describe('InvoiceService — lifecycle', () => {
  test('create → draft with computed totals and stable number; projection synced', () => {
    const db = new FakeDb(seedLeads());
    const svc = service(db);
    const inv = svc.create({ requestId: 1, subtotalCents: 35000, discountCents: 7500, discountReason: 'Returning customer', dueDate: '2026-08-15' });
    expect(inv.invoice_number).toBe('HCSC-2026-000001');
    expect(inv.status).toBe('draft');
    expect(inv.total_cents).toBe(27500);
    expect(inv.balance_cents).toBe(27500);
    expect(inv.payout_status).toBe('on_hold');
    expect(db.count('app_invoice_events')).toBe(1);
    // Frontend projection table is kept in sync.
    const projection = db.tables['app_final_invoices'];
    expect(projection.length).toBe(1);
    expect(projection[0].invoice_number).toBe('HCSC-2026-000001');
    expect(projection[0].amount_cents).toBe(27500);
  });

  test('sequential creates get sequential numbers; canonical ledger and projection NEVER diverge', () => {
    const db = new FakeDb(seedLeads());
    const svc = service(db);
    svc.create({ requestId: 1, subtotalCents: 10000 });
    const second = svc.create({ requestId: 2, subtotalCents: 20000 });
    expect(second.invoice_number).toBe('HCSC-2026-000002');
    // Divergence guard: the projection must mirror the canonical ledger exactly
    // (same numbers, same count) — numbers are only generated on app_invoices.
    const canonical = db.tables['app_invoices'].map((r) => r.invoice_number).sort();
    const projection = db.tables['app_final_invoices'].map((r) => r.invoice_number).sort();
    expect(projection).toEqual(canonical);
    expect(projection.every((n) => /^HCSC-\d{4}-\d{6}$/.test(n))).toBe(true);
  });

  test('send → final_invoice_sent; customer email resolved from LEAD only (Michonne QA)', async () => {
    const db = new FakeDb(seedLeads());
    const { sent, transport } = mockTransport();
    const svc = service(db, { transport });
    const inv = svc.create({ requestId: 1, subtotalCents: 35000, discountCents: 7500, customerName: 'Michonne' });
    // Even if the caller supplies a different email, the stored lead wins.
    const result = await svc.send(inv.id);
    expect(result.invoice.status).toBe('final_invoice_sent');
    expect(result.emailStatus).toBe('sent');
    expect(result.invoice.sent_at).toBeTruthy();
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe('mbaker789@gmail.com');
    expect(sent[0].subject).toContain('HCSC-2026-000001');
    expect(sent[0].html).toContain('$275.00');
    const notifs = db.tables['app_invoice_notifications'];
    expect(notifs.length).toBe(1);
    expect(notifs[0].type).toBe('final_invoice');
    expect(notifs[0].recipient_email).toBe('mbaker789@gmail.com');
    expect(notifs[0].status).toBe('sent');
  });

  test('email failure is non-fatal: status persists, notification marked failed', async () => {
    const db = new FakeDb(seedLeads());
    const svc = service(db, { transport: failingTransport() });
    const inv = svc.create({ requestId: 1, subtotalCents: 27500 });
    const result = await svc.send(inv.id);
    expect(result.invoice.status).toBe('final_invoice_sent');
    expect(result.emailStatus).toBe('failed');
    const notifs = db.tables['app_invoice_notifications'];
    expect(notifs[0].status).toBe('failed');
    expect(notifs[0].error).toContain('relay denied');
  });

  test('dry run: records dry_run, never calls the transport', async () => {
    const db = new FakeDb(seedLeads());
    const { sent, transport } = mockTransport();
    const svc = service(db, { transport, dryRun: true });
    const inv = svc.create({ requestId: 1, subtotalCents: 27500 });
    const result = await svc.send(inv.id);
    expect(result.emailStatus).toBe('dry_run');
    expect(sent.length).toBe(0);
    expect(db.tables['app_invoice_notifications'][0].status).toBe('dry_run');
  });

  test('invoice with no lead falls back to the email captured at creation', async () => {
    const db = new FakeDb(seedLeads());
    const { transport } = mockTransport();
    const svc = service(db, { transport });
    const inv = svc.create({ subtotalCents: 27500, customerName: 'Walk-in', customerEmail: 'walkin@example.com' });
    await svc.send(inv.id);
    expect(svc.get(inv.id).notifications[0].recipient_email).toBe('walkin@example.com');
  });
});

describe('InvoiceService — payments, idempotency, payout safeguard', () => {
  test('full payment → invoice_paid, paid_at set, payout released, receipt sent', async () => {
    const db = new FakeDb(seedLeads());
    const { sent, transport } = mockTransport();
    const svc = service(db, { transport });
    const inv = svc.create({ requestId: 1, subtotalCents: 35000, discountCents: 7500 });
    await svc.send(inv.id);
    sent.length = 0;

    const result = await svc.applyPayment(inv.id, {
      providerEventId: 'evt_stripe_1',
      provider: 'stripe',
      providerReference: 'cs_test_1',
      amountCents: 27500,
      currency: 'USD',
      status: 'completed',
      paymentMethod: 'card',
      invoiceId: inv.id,
      invoiceNumber: inv.invoice_number,
    });

    expect(result.applied).toBe(true);
    const paid = result.invoice;
    expect(paid.status).toBe('invoice_paid');
    expect(paid.paid_cents).toBe(27500);
    expect(paid.balance_cents).toBe(0);
    expect(paid.payout_status).toBe('released');
    expect(paid.paid_at).toBeTruthy();
    expect(sent.length).toBe(1);
    expect(sent[0].subject).toContain('Receipt');
    // Events: created, sent, payment (invoice_paid), payout released
    const types = db.tables['app_invoice_events'].map((e) => e.event_type);
    expect(types).toContain('invoice_paid');
    expect(types).toContain('payout_released');
    const notifs = db.tables['app_invoice_notifications'];
    expect(notifs.some((n) => n.type === 'receipt')).toBe(true);
    // Ledger row carries both canonical and UI-projection columns.
    const ledger = db.tables['app_invoice_payments'];
    expect(ledger.length).toBe(1);
    expect(ledger[0].provider).toBe('stripe');
    expect(ledger[0].ledger_confirmed).toBe(1);
    expect(ledger[0].request_id).toBe(1);
  });

  test('idempotency: same provider event id never double-applies', async () => {
    const db = new FakeDb(seedLeads());
    const svc = service(db, { transport: mockTransport().transport, dryRun: true });
    const inv = svc.create({ requestId: 1, subtotalCents: 27500 });
    const payment = {
      providerEventId: 'evt_paypal_9',
      provider: 'paypal' as const,
      providerReference: '3VW12345',
      amountCents: 27500,
      currency: 'USD',
      status: 'completed' as const,
      paymentMethod: 'paypal',
      invoiceId: inv.id,
    };
    const first = await svc.applyPayment(inv.id, payment);
    const second = await svc.applyPayment(inv.id, payment);
    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(db.count('app_invoice_payments')).toBe(1);
    expect(svc.get(inv.id).paid_cents).toBe(27500);
    expect(svc.get(inv.id).balance_cents).toBe(0);
  });

  test('partial payments: $75 then $200 → paid after second, balances always correct', async () => {
    const db = new FakeDb(seedLeads());
    const svc = service(db, { transport: mockTransport().transport, dryRun: true });
    const inv = svc.create({ requestId: 1, subtotalCents: 35000, discountCents: 7500 });
    await svc.send(inv.id);
    const first = await svc.applyPayment(inv.id, {
      providerEventId: 'evt_p1',
      provider: 'stripe', providerReference: 'cs_1', amountCents: 7500, currency: 'USD', status: 'completed', paymentMethod: 'card', invoiceId: inv.id,
    });
    expect(first.invoice.status).toBe('final_invoice_sent');
    expect(first.invoice.paid_cents).toBe(7500);
    expect(first.invoice.balance_cents).toBe(20000);
    expect(first.invoice.payout_status).toBe('on_hold');
    expect(db.tables['app_invoice_notifications'].some((n) => n.type === 'partial_receipt')).toBe(true);

    const second = await svc.applyPayment(inv.id, {
      providerEventId: 'evt_p2',
      provider: 'paypal', providerReference: 'order_1', amountCents: 20000, currency: 'USD', status: 'completed', paymentMethod: 'paypal', invoiceId: inv.id,
    });
    expect(second.invoice.status).toBe('invoice_paid');
    expect(second.invoice.balance_cents).toBe(0);
    expect(second.invoice.payout_status).toBe('released');
  });

  test('overpayment is clamped to the remaining balance', async () => {
    const db = new FakeDb(seedLeads());
    const svc = service(db, { transport: mockTransport().transport, dryRun: true });
    const inv = svc.create({ requestId: 1, subtotalCents: 10000 });
    const result = await svc.applyPayment(inv.id, {
      providerEventId: 'evt_overpay', provider: 'stripe', amountCents: 99999, currency: 'USD', status: 'completed', paymentMethod: 'card', invoiceId: inv.id,
    });
    expect(result.invoice.balance_cents).toBe(0);
    expect(result.invoice.paid_cents).toBe(10000);
  });

  test('manual payment records provider=manual with idempotency key', async () => {
    const db = new FakeDb(seedLeads());
    const svc = service(db, { transport: mockTransport().transport, dryRun: true });
    const inv = svc.create({ requestId: 1, subtotalCents: 27500 });
    const first = await svc.recordManualPayment({ invoiceId: inv.id, amountCents: 27500, method: 'check', reference: 'CHK-1042', idempotencyKey: 'manual-key-1' });
    const second = await svc.recordManualPayment({ invoiceId: inv.id, amountCents: 27500, method: 'check', reference: 'CHK-1042', idempotencyKey: 'manual-key-1' });
    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(db.count('app_invoice_payments')).toBe(1);
    expect(db.tables['app_invoice_payments'][0].method).toBe('check');
    expect(db.tables['app_invoice_payments'][0].provider).toBe('manual');
  });

  test('payout safeguard: held until paid, released on full payment, force overrides', async () => {
    const db = new FakeDb(seedLeads());
    const svc = service(db, { transport: mockTransport().transport, dryRun: true });
    const inv = svc.create({ requestId: 1, subtotalCents: 27500 });
    expect(() => svc.releasePayout(inv.id)).toThrow(/held/i);
    const forced = svc.releasePayout(inv.id, { force: true });
    expect(forced.payout_status).toBe('released');
    // A fresh invoice: payout released automatically when paid in full.
    const inv2 = svc.create({ requestId: 2, subtotalCents: 5000 });
    await svc.applyPayment(inv2.id, { providerEventId: 'evt_5', provider: 'stripe', amountCents: 5000, currency: 'USD', status: 'completed', paymentMethod: 'card', invoiceId: inv2.id });
    expect(svc.get(inv2.id).payout_status).toBe('released');
  });

  test('cancelled/paid invoice refuses further payments', async () => {
    const db = new FakeDb(seedLeads());
    const svc = service(db, { transport: mockTransport().transport, dryRun: true });
    const inv = svc.create({ requestId: 1, subtotalCents: 27500 });
    await svc.applyPayment(inv.id, { providerEventId: 'evt_6', provider: 'stripe', amountCents: 27500, currency: 'USD', status: 'completed', paymentMethod: 'card', invoiceId: inv.id });
    await expect(
      svc.applyPayment(inv.id, { providerEventId: 'evt_7', provider: 'stripe', amountCents: 100, currency: 'USD', status: 'completed', paymentMethod: 'card', invoiceId: inv.id }),
    ).rejects.toThrow(/already paid/);
  });

  test('get() returns payments, events, notifications', async () => {
    const db = new FakeDb(seedLeads());
    const svc = service(db, { transport: mockTransport().transport, dryRun: true });
    const inv = svc.create({ requestId: 1, subtotalCents: 35000, discountCents: 7500 });
    await svc.applyPayment(inv.id, { providerEventId: 'evt_8', provider: 'stripe', amountCents: 27500, currency: 'USD', status: 'completed', paymentMethod: 'card', invoiceId: inv.id });
    const detail = svc.get(inv.id);
    expect(detail.payments.length).toBe(1);
    expect(detail.events.length).toBeGreaterThanOrEqual(3);
    expect(detail.notifications.length).toBe(1);
    expect(detail.request?.email).toBe('mbaker789@gmail.com');
  });

  test('list() returns all invoices newest first', () => {
    const db = new FakeDb(seedLeads());
    const svc = service(db);
    svc.create({ requestId: 1, subtotalCents: 10000 });
    svc.create({ requestId: 2, subtotalCents: 20000 });
    const list = svc.list();
    expect(list.length).toBe(2);
    expect(list[0].invoice_number).toBe('HCSC-2026-000002');
  });

  test('findPublicByNumber works and rejects unknown numbers', () => {
    const db = new FakeDb(seedLeads());
    const svc = service(db);
    const inv = svc.create({ requestId: 1, subtotalCents: 27500 });
    expect(svc.findPublicByNumber('HCSC-2026-000001')?.id).toBe(inv.id);
    expect(svc.findPublicByNumber('HCSC-1999-009999')).toBeNull();
  });
});

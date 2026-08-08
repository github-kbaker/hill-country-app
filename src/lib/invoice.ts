/**
 * Final-invoice ledger domain service.
 *
 * Canonical status flow (additive — existing workflows untouched):
 *   app_repair_requests.status: completed  →  app_invoices.status:
 *     draft → final_invoice_sent → invoice_paid   (or cancelled)
 *
 * Everything money is integer cents. Idempotency is enforced by a UNIQUE
 * event_key / provider_event_id in the ledger: webhook redeliveries and
 * double-clicks can never double-apply a payment.
 *
 * Email failures are never fatal: state persists, the notification row is
 * marked 'failed', and an admin can resend. Customer email is ALWAYS resolved
 * from the stored lead, never from request bodies.
 */

import { randomUUID } from 'node:crypto';
import { createCustomerTransport, sendEmail, renderFinalInvoiceEmail, renderReceiptEmail, type TransportLike, type SendResult } from '@/lib/email';
import type { NormalizedPayment } from '@/lib/payments/provider';

export type InvoiceStatus = 'draft' | 'final_invoice_sent' | 'invoice_paid' | 'cancelled';
export type PayoutStatus = 'on_hold' | 'released';
export type InvoicePaymentProvider = 'stripe' | 'paypal' | 'manual';

export interface DbClient {
  query: (sql: string) => any;
}

export interface InvoiceRow {
  id: number;
  request_id: number | null;
  invoice_number: string;
  status: InvoiceStatus;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  currency: string;
  due_date: string | null;
  payment_methods: string;
  payout_status: PayoutStatus;
  discount_reason: string | null;
  customer_name: string | null;
  customer_email: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceInput {
  requestId?: number | null;
  subtotalCents: number;
  discountCents?: number;
  taxCents?: number;
  discountReason?: string;
  dueDate?: string;
  paymentMethods?: string;
  customerName?: string;
  customerEmail?: string;
}

export interface InvoiceServiceOptions {
  db: DbClient;
  customerTransport?: TransportLike;
  now?: () => Date;
  dryRun?: boolean;
}

export interface InvoiceDetail extends InvoiceRow {
  request?: Record<string, unknown> | null;
  payments: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Pure currency-safe calculation (integer cents only)
// ---------------------------------------------------------------------------

export interface Totals {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  balanceCents: number;
}

/**
 * Currency-safe invoice totals. Every input must be an integer number of
 * cents; throws on non-integers so float drift can never corrupt the ledger.
 * Michonne QA fixture: subtotal 35000 − discount 7500 = total 27500 ($275).
 */
export function calculateInvoiceTotals(input: { subtotalCents: number; discountCents?: number; taxCents?: number }): Totals {
  const { subtotalCents, discountCents = 0, taxCents = 0 } = input;
  for (const [label, v] of Object.entries({ subtotalCents, discountCents, taxCents })) {
    if (!Number.isInteger(v)) throw new Error(`Invoice ${label} must be an integer number of cents, got ${v}`);
    if (v < 0) throw new Error(`Invoice ${label} cannot be negative`);
  }
  if (discountCents > subtotalCents) throw new Error('Discount cannot exceed subtotal');
  const totalCents = subtotalCents - discountCents + taxCents;
  return { subtotalCents, discountCents, taxCents, totalCents, balanceCents: totalCents };
}

// ---------------------------------------------------------------------------
// Stable invoice numbering: HCSC-YYYY-NNNNNN (6-digit per-year sequence),
// never reused. Single source of truth: numbers are generated ONLY here, from
// the canonical app_invoices ledger (UNIQUE constraint on invoice_number).
// The frontend projection (app_final_invoices) never generates numbers — it is
// synced with the canonical number, so the two can never diverge.
// ---------------------------------------------------------------------------

export function formatInvoiceNumber(year: number, seq: number): string {
  return `HCSC-${year}-${String(seq).padStart(6, '0')}`;
}

export function parseInvoiceNumber(invoiceNumber: string): { year: number; seq: number } | null {
  const m = /^HCSC-(\d{4})-(\d{6})$/.exec(invoiceNumber.trim());
  if (!m) return null;
  return { year: Number(m[1]), seq: Number(m[2]) };
}

/** Next stable number for a year given existing numbers (pure, testable). */
export function nextInvoiceNumber(existing: string[], year: number): string {
  const maxSeq = existing.reduce((max, num) => {
    const parsed = parseInvoiceNumber(num);
    if (parsed && parsed.year === year && parsed.seq > max) return parsed.seq;
    return max;
  }, 0);
  return formatInvoiceNumber(year, maxSeq + 1);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const esc = (s: unknown) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);

export class InvoiceService {
  private db: DbClient;
  private transport: TransportLike;
  private now: () => Date;
  private dryRun: boolean;

  constructor(opts: InvoiceServiceOptions) {
    this.db = opts.db;
    this.transport = opts.customerTransport ?? createCustomerTransport();
    this.now = opts.now ?? (() => new Date());
    this.dryRun = opts.dryRun ?? process.env.EMAIL_DRY_RUN === 'true';
  }

  private iso(): string {
    return this.now().toISOString();
  }

  private lastInsertId(): number | null {
    const rows = this.db.query('SELECT last_insert_rowid() AS id');
    return rows?.[0]?.id ?? null;
  }

  private getInvoice(id: number): InvoiceRow {
    const rows = this.db.query(`SELECT * FROM app_invoices WHERE id = ${id}`);
    if (!rows?.length) throw new Error(`Invoice ${id} not found`);
    return rows[0] as InvoiceRow;
  }

  /**
   * Sync the frontend agent's UI projection table (app_final_invoices) so the
   * existing invoice screens keep working off the canonical ledger. Always
   * overwritten from the canonical row: we clear any projection rows for the
   * same request OR the same invoice_number, then insert the canonical number —
   * the projection can therefore never carry a divergent invoice number.
   */
  private syncProjection(invoice: InvoiceRow, payLinkStripe?: string | null, payLinkPaypal?: string | null) {
    try {
      if (invoice.request_id != null) {
        this.db.query(`DELETE FROM app_final_invoices WHERE request_id = ${invoice.request_id}`);
      }
      this.db.query(`DELETE FROM app_final_invoices WHERE invoice_number = ${esc(invoice.invoice_number)}`);
      this.db.query(
        `INSERT INTO app_final_invoices (request_id, invoice_number, amount_cents, status, payment_methods, currency, issued_at, sent_at, due_date, pay_link_stripe, pay_link_paypal, notes, updated_at)
         VALUES (${esc(invoice.request_id)}, ${esc(invoice.invoice_number)}, ${invoice.total_cents}, ${esc(invoice.status)}, ${esc(invoice.payment_methods)}, ${esc(invoice.currency)}, ${esc(invoice.created_at)}, ${esc(invoice.sent_at)}, ${esc(invoice.due_date)}, ${esc(payLinkStripe ?? null)}, ${esc(payLinkPaypal ?? null)}, ${esc(`discount ${(invoice.discount_cents / 100).toFixed(2)}; paid ${(invoice.paid_cents / 100).toFixed(2)}; balance ${(invoice.balance_cents / 100).toFixed(2)}`)} , ${esc(this.iso())})`,
      );
    } catch (err) {
      console.warn(`[invoice:projection] sync failed for ${invoice.invoice_number}: ${(err as Error).message}`);
    }
  }

  private logEvent(invoiceId: number, eventKey: string, eventType: string, detail: string, provider?: string) {
    try {
      this.db.query(
        `INSERT INTO app_invoice_events (invoice_id, event_key, event_type, provider, detail, created_at)
         VALUES (${invoiceId}, ${esc(eventKey)}, ${esc(eventType)}, ${esc(provider ?? null)}, ${esc(detail)}, ${esc(this.iso())})`,
      );
    } catch (err) {
      // Unique violation = event already recorded; treat as idempotent success.
      console.warn(`[invoice:events] ${eventKey} already recorded (${(err as Error).message})`);
    }
  }

  private async notify(
    invoice: InvoiceRow,
    type: 'final_invoice' | 'receipt' | 'partial_receipt',
    recipientEmail: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<{ status: string; messageId?: string; error?: string }> {
    if (this.dryRun) {
      this.db.query(
        `INSERT INTO app_invoice_notifications (invoice_id, type, recipient_email, subject, status, error, created_at)
         VALUES (${invoice.id}, ${esc(type)}, ${esc(recipientEmail)}, ${esc(subject)}, 'dry_run', NULL, ${esc(this.iso())})`,
      );
      return { status: 'dry_run' };
    }
    try {
      const result: SendResult = await sendEmail(this.transport, { from: undefined, to: recipientEmail, subject, html, text });
      this.db.query(
        `INSERT INTO app_invoice_notifications (invoice_id, type, recipient_email, subject, status, message_id, error, created_at)
         VALUES (${invoice.id}, ${esc(type)}, ${esc(recipientEmail)}, ${esc(subject)}, 'sent', ${esc(result.messageId ?? null)}, NULL, ${esc(this.iso())})`,
      );
      return { status: 'sent', messageId: result.messageId };
    } catch (err) {
      const msg = (err as Error).message;
      this.db.query(
        `INSERT INTO app_invoice_notifications (invoice_id, type, recipient_email, subject, status, error, created_at)
         VALUES (${invoice.id}, ${esc(type)}, ${esc(recipientEmail)}, ${esc(subject)}, 'failed', ${esc(msg)}, ${esc(this.iso())})`,
      );
      return { status: 'failed', error: msg };
    }
  }

  /** Customer email ALWAYS comes from the stored lead record; falls back to the email captured at invoice creation. */
  private resolveRecipientEmail(leadEmail?: string | null, invoiceEmail?: string | null): string {
    const resolved = leadEmail ?? invoiceEmail;
    if (!resolved) throw new Error('No customer email on file for this invoice');
    return resolved;
  }

  private loadLead(requestId: number | null): { name?: string; email?: string } | null {
    if (!requestId) return null;
    const rows = this.db.query(`SELECT name, email FROM app_repair_requests WHERE id = ${requestId}`);
    return rows?.[0] ?? null;
  }

  // -- lifecycle ------------------------------------------------------------

  /** Create a draft final invoice with computed totals + stable numbering. */
  create(input: CreateInvoiceInput, idempotencyKey?: string): InvoiceRow {
    const totals = calculateInvoiceTotals(input);
    const year = this.now().getFullYear();
    const existing = (this.db.query('SELECT invoice_number FROM app_invoices') ?? []) as Array<{ invoice_number: string }>;
    const invoiceNumber = nextInvoiceNumber(existing.map((r) => r.invoice_number), year);

    const now = this.iso();
    this.db.query(
      `INSERT INTO app_invoices (request_id, invoice_number, status, subtotal_cents, discount_cents, tax_cents, total_cents, paid_cents, balance_cents, currency, due_date, payment_methods, payout_status, discount_reason, customer_name, customer_email, created_at, updated_at)
       VALUES (${esc(input.requestId ?? null)}, ${esc(invoiceNumber)}, 'draft', ${totals.subtotalCents}, ${totals.discountCents}, ${totals.taxCents}, ${totals.totalCents}, 0, ${totals.totalCents}, 'USD', ${esc(input.dueDate ?? null)}, ${esc(input.paymentMethods ?? 'stripe,paypal,manual')}, 'on_hold', ${esc(input.discountReason ?? null)}, ${esc(input.customerName ?? null)}, ${esc(input.customerEmail ?? null)}, ${esc(now)}, ${esc(now)})`,
    );
    const id = this.lastInsertId();
    if (!id) throw new Error('Failed to persist invoice');
    this.logEvent(id, idempotencyKey ?? `invoice:created:${id}`, 'invoice_created', `Created ${invoiceNumber} (${(totals.totalCents / 100).toFixed(2)})`);
    const created = this.getInvoice(id);
    this.syncProjection(created);
    return created;
  }

  /** Transition draft → final_invoice_sent and email the customer. */
  async send(invoiceId: number, opts?: { idempotencyKey?: string }): Promise<{ invoice: InvoiceRow; emailStatus: string }> {
    const invoice = this.getInvoice(invoiceId);
    if (invoice.status === 'invoice_paid' || invoice.status === 'cancelled') {
      throw new Error(`Cannot send invoice in status ${invoice.status}`);
    }
    if (invoice.status !== 'final_invoice_sent') {
      this.db.query(
        `UPDATE app_invoices SET status = 'final_invoice_sent', sent_at = ${esc(this.iso())}, updated_at = ${esc(this.iso())} WHERE id = ${invoice.id}`,
      );
    }
    this.logEvent(invoice.id, opts?.idempotencyKey ?? `invoice:sent:${invoice.id}`, 'invoice_sent', `Final invoice ${invoice.invoice_number} sent`);

    const lead = this.loadLead(invoice.request_id);
    const recipient = this.resolveRecipientEmail(lead?.email, invoice.customer_email);
    const mail = renderFinalInvoiceEmail({
      customerName: lead?.name ?? invoice.customer_name ?? 'Customer',
      invoiceNumber: invoice.invoice_number,
      totalCents: invoice.total_cents,
      paidCents: invoice.paid_cents,
      balanceCents: invoice.balance_cents,
      dueDate: invoice.due_date ?? undefined,
      paymentLink: undefined,
    });
    const res = await this.notify(invoice, 'final_invoice', recipient, mail.subject, mail.html, mail.text);
    const sent = this.getInvoice(invoice.id);
    this.syncProjection(sent);
    return { invoice: sent, emailStatus: res.status };
  }

  /**
   * Apply a provider payment to the ledger (idempotent by providerEventId).
   * Handles partial payments: paid_cents/balance_cents update per payment;
   * invoice_paid only when balance reaches zero; payout safeguard released
   * on full payment.
   */
  async applyPayment(invoiceId: number, payment: NormalizedPayment, opts?: { note?: string }): Promise<{ invoice: InvoiceRow; payment: Record<string, unknown>; applied: boolean; receiptStatus?: string }> {
    const key = `${payment.provider}:${payment.providerEventId}`;
    const existing = this.db.query(`SELECT id FROM app_invoice_payments WHERE provider_event_id = ${esc(key)}`);
    if (existing?.length) {
      return { invoice: this.getInvoice(invoiceId), payment: existing[0], applied: false };
    }
    if (payment.amountCents <= 0) throw new Error('Payment amount must be positive');

    const invoice = this.getInvoice(invoiceId);
    if (invoice.status === 'cancelled') throw new Error(`Cannot pay cancelled invoice ${invoice.invoice_number}`);
    const amount = Math.min(payment.amountCents, invoice.balance_cents);
    if (amount <= 0) throw new Error(`Invoice ${invoice.invoice_number} is already paid in full`);

    const now = this.iso();
    this.db.query(
      `INSERT INTO app_invoice_payments (invoice_id, request_id, provider, provider_event_id, provider_reference, amount_cents, currency, status, payment_method, method, reference, customer_email, customer_name, note, ledger_confirmed, recorded_at, confirmed_at, created_at)
       VALUES (${invoice.id}, ${esc(invoice.request_id)}, ${esc(payment.provider)}, ${esc(key)}, ${esc(payment.providerReference ?? null)}, ${amount}, ${esc(payment.currency || 'USD')}, ${esc(payment.status)}, ${esc(payment.paymentMethod ?? null)}, ${esc(payment.paymentMethod ?? null)}, ${esc(payment.providerReference ?? null)}, ${esc(payment.customerEmail ?? null)}, ${esc(payment.customerName ?? null)}, ${esc(opts?.note ?? null)}, 1, ${esc(now)}, ${esc(now)}, ${esc(now)})`,
    );
    const paymentId = this.lastInsertId();

    const newPaid = invoice.paid_cents + amount;
    const newBalance = invoice.total_cents - newPaid;
    const isPaidInFull = newBalance <= 0;
    const nextStatus: InvoiceStatus = isPaidInFull ? 'invoice_paid' : invoice.status === 'draft' ? 'draft' : 'final_invoice_sent';
    this.db.query(
      `UPDATE app_invoices SET paid_cents = ${newPaid}, balance_cents = ${Math.max(0, newBalance)}, status = ${esc(nextStatus)},
        paid_at = ${isPaidInFull ? esc(now) : 'paid_at'},
        payout_status = ${isPaidInFull ? "'released'" : 'payout_status'},
        updated_at = ${esc(now)} WHERE id = ${invoice.id}`,
    );

    this.logEvent(
      invoice.id,
      key,
      isPaidInFull ? 'invoice_paid' : 'payment_completed',
      `${payment.provider} ${payment.providerReference ?? payment.providerEventId}: +$${(amount / 100).toFixed(2)}, balance $${(Math.max(0, newBalance) / 100).toFixed(2)}${isPaidInFull ? ', payout released' : ''}`,
      payment.provider,
    );
    if (isPaidInFull) {
      this.logEvent(invoice.id, `payout:released:${invoice.id}`, 'payout_released', `Payout released for ${invoice.invoice_number}`, payment.provider);
    }

    const updated = this.getInvoice(invoice.id);
    const lead = this.loadLead(invoice.request_id);
    const receipt = renderReceiptEmail({
      customerName: lead?.name ?? invoice.customer_name ?? 'Customer',
      invoiceNumber: updated.invoice_number,
      totalCents: updated.total_cents,
      paidCents: updated.paid_cents,
      balanceCents: updated.balance_cents,
    });
    const receiptStatus = await this.notify(
      updated,
      isPaidInFull ? 'receipt' : 'partial_receipt',
      this.resolveRecipientEmail(lead?.email, updated.customer_email),
      receipt.subject,
      receipt.html,
      receipt.text,
    );
    this.syncProjection(updated);
    return { invoice: updated, payment: { id: paymentId, provider: payment.provider, amount_cents: amount }, applied: true, receiptStatus: receiptStatus.status };
  }

  /** Record a manual payment (check / cash / card over phone). */
  async recordManualPayment(input: { invoiceId: number; amountCents: number; method: string; reference?: string; note?: string; idempotencyKey?: string }): Promise<{ invoice: InvoiceRow; applied: boolean }> {
    const key = input.idempotencyKey ?? cryptoRandom();
    const existing = this.db.query(`SELECT id FROM app_invoice_payments WHERE provider_event_id = ${esc(`manual:${key}`)}`);
    if (existing?.length) return { invoice: this.getInvoice(input.invoiceId), applied: false };
    return this.applyPayment(input.invoiceId, {
      providerEventId: key,
      provider: 'manual',
      providerReference: input.reference,
      amountCents: input.amountCents,
      currency: 'USD',
      status: 'completed',
      paymentMethod: input.method,
    }, { note: input.note });
  }

  /** Payout safeguard: refused until the invoice is paid in full unless forced. */
  releasePayout(invoiceId: number, opts?: { force?: boolean; idempotencyKey?: string }): InvoiceRow {
    const invoice = this.getInvoice(invoiceId);
    if (invoice.payout_status === 'released') return invoice;
    if (invoice.status !== 'invoice_paid' && !opts?.force) {
      throw new Error(`Payout for ${invoice.invoice_number} is held: invoice is not paid in full`);
    }
    this.db.query(`UPDATE app_invoices SET payout_status = 'released', updated_at = ${esc(this.iso())} WHERE id = ${invoice.id}`);
    this.logEvent(invoice.id, opts?.idempotencyKey ?? `payout:released:${invoice.id}`, 'payout_released', `Payout released for ${invoice.invoice_number}`);
    const released = this.getInvoice(invoice.id);
    this.syncProjection(released);
    return released;
  }

  // -- reads -----------------------------------------------------------------

  list(): InvoiceRow[] {
    return (this.db.query('SELECT * FROM app_invoices ORDER BY id DESC') ?? []) as InvoiceRow[];
  }

  get(invoiceId: number): InvoiceDetail {
    const invoice = this.getInvoice(invoiceId);
    return {
      ...invoice,
      request: this.loadLead(invoice.request_id) as unknown as Record<string, unknown> | null,
      payments: this.db.query(`SELECT * FROM app_invoice_payments WHERE invoice_id = ${invoiceId} ORDER BY id`) ?? [],
      events: this.db.query(`SELECT * FROM app_invoice_events WHERE invoice_id = ${invoiceId} ORDER BY id`) ?? [],
      notifications: this.db.query(`SELECT * FROM app_invoice_notifications WHERE invoice_id = ${invoiceId} ORDER BY id`) ?? [],
    };
  }

  /** For the payment page: invoice by number (public, safe subset). */
  findPublicByNumber(invoiceNumber: string): InvoiceRow | null {
    const rows = this.db.query(`SELECT * FROM app_invoices WHERE invoice_number = ${esc(invoiceNumber)}`);
    return rows?.[0] ?? null;
  }
}

function cryptoRandom(): string {
  return randomUUID();
}

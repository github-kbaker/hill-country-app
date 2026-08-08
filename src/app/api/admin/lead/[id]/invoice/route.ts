import { NextResponse } from 'next/server';
import { query, escape } from '@/lib/db';
import { isAdminRequest } from '@/lib/admin-auth';
import { parseInvoiceNumber, formatInvoiceNumber } from '@/lib/invoice';
import { createCustomerTransport, sendEmail, renderFinalInvoiceEmail, renderReceiptEmail } from '@/lib/email';
import {
  invoiceTotals,
  derivedInvoiceStatus,
  canGenerateInvoice,
  canMarkInvoicePaid,
  type Lead,
  type FinalInvoice,
  type InvoicePaymentRow,
  type PaymentMethod,
  type InvoicePaymentMethod,
} from '@/lib/lead-workflow';

export const dynamic = 'force-dynamic';

const VALID_METHODS: PaymentMethod[] = ['stripe', 'paypal'];
const VALID_RECORD_METHODS: InvoicePaymentMethod[] = ['stripe', 'paypal', 'manual'];

function getLead(id: number): Lead | null {
  const rows = query(`SELECT * FROM app_repair_requests WHERE id = ${id}`);
  return (rows as Lead[])[0] ?? null;
}

function getInvoice(id: number): FinalInvoice | null {
  const rows = query(`SELECT * FROM app_final_invoices WHERE id = ${id}`);
  return (rows as FinalInvoice[])[0] ?? null;
}

function getInvoiceForRequest(requestId: number): FinalInvoice | null {
  const rows = query(`SELECT * FROM app_final_invoices WHERE request_id = ${requestId} ORDER BY id DESC LIMIT 1`);
  return (rows as FinalInvoice[])[0] ?? null;
}

function getInvoicePayments(invoiceId: number): InvoicePaymentRow[] {
  return query(`SELECT * FROM app_invoice_payments WHERE invoice_id = ${invoiceId} ORDER BY id DESC`) as InvoicePaymentRow[];
}

/**
 * Next invoice number in the canonical HCSC-YYYY-NNNNNN format.
 * Derives the per-year sequence from BOTH the canonical ledger (app_invoices)
 * and the projection (app_final_invoices) so every creation path advances the
 * same sequence and the two tables can never diverge or duplicate numbers.
 */
function nextInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const canonical = query('SELECT invoice_number FROM app_invoices') as Array<{ invoice_number: string }>;
  const projection = query('SELECT invoice_number FROM app_final_invoices') as Array<{ invoice_number: string }>;
  const maxSeq = [...canonical, ...projection].reduce((max, row) => {
    const parsed = parseInvoiceNumber(row.invoice_number);
    return parsed && parsed.year === year && parsed.seq > max ? parsed.seq : max;
  }, 0);
  return formatInvoiceNumber(year, maxSeq + 1);
}

function logActivity(requestId: number, action: string, detail: string) {
  query(
    `INSERT INTO app_lead_activities (request_id, action, detail) VALUES (${requestId}, ${escape(action)}, ${escape(detail)})`
  );
}

function recordNotification(requestId: number, type: string, recipientEmail: string, status: string, error: string | null) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  query(
    `INSERT INTO app_schedule_notifications (request_id, type, recipient_email, status, error, sent_at) VALUES (${requestId}, ${escape(type)}, ${escape(recipientEmail)}, ${escape(status)}, ${escape(error)}, ${escape(now)})`
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const action = typeof body.action === 'string' ? body.action : '';
  const lead = getLead(id);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const invoice = getInvoiceForRequest(id);

  /* ------------------------------------------------------------ */
  /* GENERATE — draft only, never emailed                          */
  /* ------------------------------------------------------------ */
  if (action === 'generate') {
    if (!canGenerateInvoice(lead, invoice)) {
      return NextResponse.json(
        { error: 'Final invoices can only be generated for completed leads without an existing invoice' },
        { status: 400 }
      );
    }
    const amountCents = Number(body.amountCents);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: 'amountCents must be a positive integer' }, { status: 400 });
    }
    const rawMethods = Array.isArray(body.paymentMethods) ? body.paymentMethods : ['stripe'];
    const methods = rawMethods.filter((m): m is PaymentMethod => VALID_METHODS.includes(m as PaymentMethod));
    if (methods.length === 0) {
      return NextResponse.json({ error: 'At least one payment method (stripe, paypal) is required' }, { status: 400 });
    }
    const dueDate = typeof body.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ? body.dueDate : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const invoiceNumber = nextInvoiceNumber();
    const paySuffix = `invoice=${encodeURIComponent(invoiceNumber)}`;
    const inserted = query(
      `INSERT INTO app_final_invoices (request_id, invoice_number, amount_cents, status, payment_methods, due_date, pay_link_stripe, pay_link_paypal, notes) VALUES (${id}, ${escape(invoiceNumber)}, ${amountCents}, 'draft', ${escape(methods.join(','))}, ${escape(dueDate)}, ${escape(`/pay?${paySuffix}&method=stripe`)}, ${escape(`/pay?${paySuffix}&method=paypal`)}, ${escape(notes)}) RETURNING *`
    ) as FinalInvoice[];
    const created = inserted[0];
    logActivity(id, 'invoice_generated', `Final invoice ${invoiceNumber} generated for $${(amountCents / 100).toFixed(2)} (no email sent)`);
    return NextResponse.json({ ok: true, invoice: created, payments: [], paidCents: 0, balanceCents: amountCents });
  }

  if (!invoice) {
    return NextResponse.json({ error: 'No final invoice exists for this lead — generate one first' }, { status: 400 });
  }

  /* ------------------------------------------------------------ */
  /* PREVIEW — render email content without sending                */
  /* ------------------------------------------------------------ */
  if (action === 'preview') {
    const kind = body.kind === 'receipt' ? 'receipt' : 'invoice';
    const { totalCents, paidCents, balanceCents } = invoiceTotals(invoice, getInvoicePayments(invoice.id));
    const content =
      kind === 'receipt'
        ? renderReceiptEmail({ customerName: lead.name, invoiceNumber: invoice.invoice_number, totalCents, paidCents, balanceCents })
        : renderFinalInvoiceEmail({ customerName: lead.name, invoiceNumber: invoice.invoice_number, totalCents, paidCents, balanceCents, dueDate: invoice.due_date ?? undefined });
    return NextResponse.json({ ok: true, preview: content });
  }

  /* ------------------------------------------------------------ */
  /* UPDATE METHODS — payment method configuration                 */
  /* ------------------------------------------------------------ */
  if (action === 'update_methods') {
    const rawMethods = Array.isArray(body.paymentMethods) ? body.paymentMethods : [];
    const methods = rawMethods.filter((m): m is PaymentMethod => VALID_METHODS.includes(m as PaymentMethod));
    if (methods.length === 0) {
      return NextResponse.json({ error: 'At least one payment method (stripe, paypal) is required' }, { status: 400 });
    }
    query(
      `UPDATE app_final_invoices SET payment_methods = ${escape(methods.join(','))}, updated_at = datetime('now') WHERE id = ${invoice.id}`
    );
    logActivity(id, 'invoice_methods_updated', `Payment methods set to: ${methods.join(', ')}`);
    return NextResponse.json({ ok: true, invoice: getInvoice(invoice.id) });
  }

  /* ------------------------------------------------------------ */
  /* SEND — dry-run guarded, records notification                  */
  /* ------------------------------------------------------------ */
  if (action === 'send') {
    if (!lead.email) return NextResponse.json({ error: 'Lead has no email address' }, { status: 400 });
    const { totalCents, paidCents, balanceCents } = invoiceTotals(invoice, getInvoicePayments(invoice.id));
    const content = renderFinalInvoiceEmail({
      customerName: lead.name,
      invoiceNumber: invoice.invoice_number,
      totalCents,
      paidCents,
      balanceCents,
      dueDate: invoice.due_date ?? undefined,
      paymentLink: `/pay?invoice=${encodeURIComponent(invoice.invoice_number)}`,
    });

    const dryRun = process.env.EMAIL_DRY_RUN === 'true';
    const transportReady =
      Boolean(process.env.RESEND_API_KEY) ||
      Boolean(process.env.SCHEDULE_EMAIL_HOST && process.env.SCHEDULE_EMAIL_USER && process.env.SCHEDULE_EMAIL_PASS);

    let status = 'sent';
    let error: string | null = null;
    if (dryRun || !transportReady) {
      status = 'dry_run';
      error = dryRun ? 'EMAIL_DRY_RUN=true — simulated, not delivered' : 'Customer email transport not configured — simulated, not delivered';
    } else {
      try {
        const transport = createCustomerTransport();
        await sendEmail(transport, { to: lead.email, subject: content.subject, html: content.html, text: content.text });
      } catch (err) {
        status = 'failed';
        error = err instanceof Error ? err.message : String(err);
      }
    }

    if (status !== 'failed') {
      // Canonical status: draft → final_invoice_sent (partial payments keep
      // final_invoice_sent with a balance; never flips to paid on send).
      query(
        `UPDATE app_final_invoices SET status = 'final_invoice_sent', sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ${invoice.id}`
      );
    }
    recordNotification(id, 'final_invoice', lead.email, status, error);
    logActivity(
      id,
      status === 'dry_run' ? 'invoice_email_dry_run' : status === 'failed' ? 'invoice_email_failed' : 'invoice_sent',
      `Final invoice ${invoice.invoice_number} → ${lead.email}${error ? ` (${error})` : ''}`
    );
    if (status === 'failed') {
      return NextResponse.json({ ok: false, dryRun: false, error }, { status: 502 });
    }
    return NextResponse.json({ ok: true, dryRun: status === 'dry_run', invoice: getInvoice(invoice.id) });
  }

  /* ------------------------------------------------------------ */
  /* RECORD PAYMENT — manual/offline entry; partial allowed        */
  /* Never marks the invoice paid — ledger confirmation required.  */
  /* ------------------------------------------------------------ */
  if (action === 'record_payment') {
    if (invoice.status === 'invoice_paid' || invoice.status === 'cancelled') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 });
    }
    const amountCents = Number(body.amountCents);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: 'amountCents must be a positive integer' }, { status: 400 });
    }
    const method = body.method as InvoicePaymentMethod;
    if (!VALID_RECORD_METHODS.includes(method)) {
      return NextResponse.json({ error: `Invalid payment method '${method}'` }, { status: 400 });
    }
    const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
    const { totalCents } = invoiceTotals(invoice, getInvoicePayments(invoice.id));
    if (amountCents > totalCents) {
      return NextResponse.json({ error: 'Payment exceeds the invoice total' }, { status: 400 });
    }
    const inserted = query(
      `INSERT INTO app_invoice_payments (invoice_id, request_id, amount_cents, method, reference, status) VALUES (${invoice.id}, ${id}, ${amountCents}, ${escape(method)}, ${escape(reference)}, 'recorded') RETURNING *`
    ) as InvoicePaymentRow[];
    const payments = getInvoicePayments(invoice.id);
    const paidCents = payments.reduce((acc, p) => acc + p.amount_cents, 0);
    const fullyCovered = paidCents >= totalCents;
    // Recorded payments never flip the invoice to 'invoice_paid'; the admin
    // must verify the payment against the ledger (Stripe/PayPal/bank) and use
    // mark_paid. Status stays 'draft' until sent, then 'final_invoice_sent'
    // while a balance remains — matching the canonical invoice vocabulary.
    logActivity(id, 'payment_recorded', `Payment of $${(amountCents / 100).toFixed(2)} recorded via ${method}${reference ? ` (ref ${reference})` : ''} — awaiting ledger confirmation`);
    return NextResponse.json({
      ok: true,
      invoice: getInvoice(invoice.id),
      payments,
      paidCents,
      balanceCents: Math.max(totalCents - paidCents, 0),
      note: fullyCovered
        ? 'Balance fully covered — confirm the ledger to mark the invoice paid.'
        : 'Payment recorded. Confirm against the ledger before marking paid.',
    });
  }

  /* ------------------------------------------------------------ */
  /* MARK PAID — safeguarded: requires ledger confirmation         */
  /* ------------------------------------------------------------ */
  if (action === 'mark_paid') {
    const ledgerConfirmed = body.ledgerConfirmed === true;
    const ledgerReference = typeof body.ledgerReference === 'string' ? body.ledgerReference.trim() : '';
    const payments = getInvoicePayments(invoice.id);
    const { totalCents } = invoiceTotals(invoice, payments);
    if (!ledgerConfirmed) {
      return NextResponse.json({ error: 'Ledger confirmation is required before marking the invoice paid' }, { status: 400 });
    }
    if (!ledgerReference) {
      return NextResponse.json({ error: 'A ledger reference (e.g. Stripe/PayPal transaction ID) is required' }, { status: 400 });
    }
    if (!canMarkInvoicePaid(invoice, payments, totalCents)) {
      return NextResponse.json(
        { error: 'Recorded payments must cover the full invoice total before it can be marked paid' },
        { status: 400 }
      );
    }
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    query(
      `UPDATE app_invoice_payments SET status = 'confirmed', ledger_confirmed = 1, confirmed_at = ${escape(now)} WHERE invoice_id = ${invoice.id}`
    );
    query(
      `UPDATE app_final_invoices SET status = 'invoice_paid', updated_at = ${escape(now)} WHERE id = ${invoice.id}`
    );
    logActivity(id, 'invoice_paid', `Invoice ${invoice.invoice_number} marked paid — ledger ref ${ledgerReference} verified`);
    return NextResponse.json({
      ok: true,
      invoice: getInvoice(invoice.id),
      payments: getInvoicePayments(invoice.id),
      paidCents: totalCents,
      balanceCents: 0,
    });
  }

  /* ------------------------------------------------------------ */
  /* RECEIPT — dry-run guarded receipt email after payment         */
  /* ------------------------------------------------------------ */
  if (action === 'receipt') {
    if (invoice.status === 'draft') {
      return NextResponse.json({ error: 'Receipts can only be sent after a payment is recorded' }, { status: 400 });
    }
    if (!lead.email) return NextResponse.json({ error: 'Lead has no email address' }, { status: 400 });
    const { totalCents, paidCents, balanceCents } = invoiceTotals(invoice, getInvoicePayments(invoice.id));
    const content = renderReceiptEmail({ customerName: lead.name, invoiceNumber: invoice.invoice_number, totalCents, paidCents, balanceCents });
    const dryRun = process.env.EMAIL_DRY_RUN === 'true';
    const transportReady =
      Boolean(process.env.RESEND_API_KEY) ||
      Boolean(process.env.SCHEDULE_EMAIL_HOST && process.env.SCHEDULE_EMAIL_USER && process.env.SCHEDULE_EMAIL_PASS);
    let status = 'sent';
    let error: string | null = null;
    if (dryRun || !transportReady) {
      status = 'dry_run';
      error = dryRun ? 'EMAIL_DRY_RUN=true — simulated, not delivered' : 'Customer email transport not configured — simulated, not delivered';
    } else {
      try {
        const transport = createCustomerTransport();
        await sendEmail(transport, { to: lead.email, subject: content.subject, html: content.html, text: content.text });
      } catch (err) {
        status = 'failed';
        error = err instanceof Error ? err.message : String(err);
      }
    }
    recordNotification(id, 'receipt', lead.email, status, error);
    logActivity(id, status === 'dry_run' ? 'receipt_email_dry_run' : status === 'failed' ? 'receipt_email_failed' : 'receipt_sent', `Receipt for ${invoice.invoice_number} → ${lead.email}${error ? ` (${error})` : ''}`);
    if (status === 'failed') return NextResponse.json({ ok: false, dryRun: false, error }, { status: 502 });
    return NextResponse.json({ ok: true, dryRun: status === 'dry_run' });
  }

  return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 });
}

/**
 * Shared lead-detail workflow: types + pure rule functions used by both the
 * admin UI and the API routes. All email/payment side effects are gated by
 * these rules — the UI hides buttons, the API enforces them.
 */

export type LeadStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled';

/**
 * Canonical invoice status vocabulary — aligned with agent-developer-3's
 * InvoiceService (src/lib/invoice.ts):
 *   draft → final_invoice_sent → invoice_paid (→ cancelled)
 * Partial payments keep `final_invoice_sent` (or `draft`) with a balance.
 */
export type InvoiceStatus = 'draft' | 'final_invoice_sent' | 'invoice_paid' | 'cancelled';

export type PaymentMethod = 'stripe' | 'paypal';

export type InvoicePaymentMethod = PaymentMethod | 'manual';

export interface Lead {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  appliance_type?: string | null;
  brand?: string | null;
  model?: string | null;
  description?: string | null;
  preferred_date?: string | null;
  preferred_time?: string | null;
  status: LeadStatus;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  cancelled_at?: string | null;
  appointment_start?: string | null;
  appointment_end?: string | null;
  appointment_local_start?: string | null;
  appointment_local_end?: string | null;
  appointment_tz?: string | null;
  duration_minutes?: number | null;
  confirmed_at?: string | null;
  cancel_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface NotificationRow {
  id: number;
  type: string;
  recipient_email?: string | null;
  status: string;
  error?: string | null;
  sent_at?: string | null;
  subject?: string | null;
}

export interface ActivityRow {
  id: number;
  action: string;
  detail?: string | null;
  created_at?: string | null;
}

export interface PaymentRow {
  id: number;
  invoice_number?: string | null;
  customer_name?: string | null;
  amount?: number | null;
  status?: string | null;
  created_at?: string | null;
}

export interface FinalInvoice {
  id: number;
  request_id: number;
  invoice_number: string;
  amount_cents: number;
  status: InvoiceStatus;
  payment_methods: string; // comma-separated
  currency: string;
  issued_at?: string | null;
  sent_at?: string | null;
  due_date?: string | null;
  pay_link_stripe?: string | null;
  pay_link_paypal?: string | null;
  notes?: string | null;
}

export interface InvoicePaymentRow {
  id: number;
  invoice_id: number;
  request_id: number;
  amount_cents: number;
  method: InvoicePaymentMethod;
  reference?: string | null;
  status: string;
  ledger_confirmed: number;
  recorded_at?: string | null;
  confirmed_at?: string | null;
}

export interface LeadDetailData {
  lead: Lead | null;
  payments: PaymentRow[];
  notifications: NotificationRow[];
  activities: ActivityRow[];
  invoice: FinalInvoice | null;
  invoicePayments: InvoicePaymentRow[];
}

export interface PatchResponse {
  ok: boolean;
  error?: string;
  lead?: Lead;
}

export interface NotifyResponse {
  ok: boolean;
  dryRun?: boolean;
  error?: string;
  notification?: NotificationRow;
}

export interface InvoiceResponse {
  ok: boolean;
  error?: string;
  invoice?: FinalInvoice;
  payments?: InvoicePaymentRow[];
  paidCents?: number;
  balanceCents?: number;
  preview?: { subject: string; html: string; text: string };
  notification?: NotificationRow;
}

/* ------------------------------------------------------------------ */
/* Schedule workflow rules                                             */
/* ------------------------------------------------------------------ */

export function hasSchedule(lead: Lead | null): boolean {
  return Boolean(lead?.scheduled_date && lead?.scheduled_time);
}

export function canMarkScheduled(lead: Lead | null): boolean {
  if (!lead) return false;
  if (lead.status === 'cancelled' || lead.status === 'completed') return false;
  return !hasSchedule(lead) || lead.status !== 'scheduled';
}

export function canSaveSchedule(lead: Lead | null): boolean {
  if (!lead) return false;
  if (lead.status === 'cancelled' || lead.status === 'completed') return false;
  return Boolean(lead.scheduled_date && lead.scheduled_time);
}

export function canSendConfirmation(lead: Lead | null): boolean {
  if (!lead) return false;
  return lead.status === 'scheduled' && hasSchedule(lead);
}

export function canSendUpdatedSchedule(lead: Lead | null): boolean {
  if (!lead) return false;
  return lead.status === 'scheduled' && hasSchedule(lead) && Boolean(lead.confirmed_at);
}

export function canReschedule(lead: Lead | null): boolean {
  if (!lead) return false;
  return lead.status === 'scheduled' && hasSchedule(lead);
}

export function canCancel(lead: Lead | null): boolean {
  if (!lead) return false;
  return lead.status !== 'cancelled' && lead.status !== 'completed';
}

export function canSendCancellation(lead: Lead | null): boolean {
  if (!lead) return false;
  return lead.status === 'cancelled' && Boolean(lead.cancelled_at);
}

export function canMarkCompleted(lead: Lead | null): boolean {
  if (!lead) return false;
  return lead.status !== 'cancelled' && lead.status !== 'completed';
}

/* ------------------------------------------------------------------ */
/* Final invoice workflow rules                                        */
/* ------------------------------------------------------------------ */

export function canGenerateInvoice(lead: Lead | null, invoice: FinalInvoice | null): boolean {
  if (!lead) return false;
  // Invoices are only issued after the job is completed — and NEVER
  // automatically. Marking a lead completed does not generate an invoice.
  return lead.status === 'completed' && !invoice;
}

export function canSendInvoice(invoice: FinalInvoice | null): boolean {
  if (!invoice) return false;
  return invoice.status === 'draft' || invoice.status === 'final_invoice_sent';
}

export function canRecordPayment(invoice: FinalInvoice | null): boolean {
  if (!invoice) return false;
  return invoice.status !== 'invoice_paid' && invoice.status !== 'cancelled';
}

export function canMarkInvoicePaid(
  invoice: FinalInvoice | null,
  payments: InvoicePaymentRow[],
  totalCents: number
): boolean {
  if (!invoice || invoice.status === 'invoice_paid' || invoice.status === 'cancelled') return false;
  const recorded = payments.filter((p) => p.status === 'recorded');
  if (recorded.length === 0) return false;
  const sum = recorded.reduce((acc, p) => acc + p.amount_cents, 0);
  // Only a fully-settled balance may be marked paid; partial payments leave
  // the invoice partially paid.
  return sum >= totalCents;
}

export function invoiceTotals(
  invoice: FinalInvoice | null,
  payments: InvoicePaymentRow[]
): { totalCents: number; paidCents: number; balanceCents: number } {
  const totalCents = invoice?.amount_cents ?? 0;
  const paidCents = (payments ?? []).reduce((acc, p) => acc + p.amount_cents, 0);
  return { totalCents, paidCents, balanceCents: Math.max(totalCents - paidCents, 0) };
}

export function derivedInvoiceStatus(payments: InvoicePaymentRow[], totalCents: number): InvoiceStatus {
  const paid = (payments ?? []).reduce((acc, p) => acc + p.amount_cents, 0);
  if (paid <= 0) return 'draft';
  if (paid >= totalCents) return 'invoice_paid';
  return 'final_invoice_sent';
}

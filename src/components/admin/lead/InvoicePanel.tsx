'use client';

import React, { useState } from 'react';
import {
  FileText,
  Send,
  Eye,
  PlusCircle,
  CheckCircle2,
  Copy,
  Link2,
  Receipt,
  ShieldCheck,
  Loader2,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/admin/lead/ConfirmDialog';
import { invoiceTotals, canMarkInvoicePaid } from '@/lib/lead-workflow';
import type { Lead, FinalInvoice, InvoicePaymentRow, PaymentMethod } from '@/lib/lead-workflow';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  final_invoice_sent: 'Final Invoice Sent',
  invoice_paid: 'Invoice Paid',
  cancelled: 'Cancelled',
};

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  final_invoice_sent: 'bg-blue-100 text-blue-700',
  invoice_paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function InvoicePanel({ lead, invoice, payments, onRefresh }: {
  lead: Lead;
  invoice: FinalInvoice | null;
  payments: InvoicePaymentRow[];
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // generate form state
  const [genAmount, setGenAmount] = useState('');
  const [genDue, setGenDue] = useState('');
  const [genNotes, setGenNotes] = useState('');
  const [genMethods, setGenMethods] = useState<PaymentMethod[]>(['stripe']);

  // dialogs
  const [showSend, setShowSend] = useState(false);
  const [showPreview, setShowPreview] = useState<string | null>(null); // html
  const [showRecord, setShowRecord] = useState(false);
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // record payment form
  const [recAmount, setRecAmount] = useState('');
  const [recMethod, setRecMethod] = useState<string>('stripe');
  const [recRef, setRecRef] = useState('');

  // mark paid form
  const [mpRef, setMpRef] = useState('');
  const [mpConfirmed, setMpConfirmed] = useState(false);

  const { totalCents, paidCents, balanceCents } = invoiceTotals(invoice, payments);
  const canPaid = canMarkInvoicePaid(invoice, payments, totalCents);

  async function api(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; note?: string; preview?: { html: string } } | null> {
    try {
      const res = await fetch(`/api/admin/lead/${lead.id}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': 'hc-admin-dev-token-2026' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error ?? 'Request failed');
        return null;
      }
      setErr(null);
      setNote(data.note ?? null);
      return data;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  function copyLink(link: string) {
    const url = `https://hillcountryappliancerepair.com${link}`;
    navigator.clipboard?.writeText(url).catch(() => undefined);
    setCopied(link);
    setTimeout(() => setCopied(null), 1600);
  }

  async function generate() {
    const dollars = Number(genAmount);
    if (!dollars || dollars <= 0) {
      setErr('Enter a valid invoice amount');
      return;
    }
    setBusy('generate');
    const data = await api({
      action: 'generate',
      amountCents: Math.round(dollars * 100),
      dueDate: genDue,
      notes: genNotes,
      paymentMethods: genMethods,
    });
    setBusy(null);
    if (data) {
      setGenAmount('');
      setGenDue('');
      setGenNotes('');
      onRefresh();
    }
  }

  async function sendInvoice() {
    setBusy('send');
    const data = await api({ action: 'send' });
    setBusy(null);
    setShowSend(false);
    if (data) onRefresh();
  }

  async function preview() {
    setBusy('preview');
    const data = await api({ action: 'preview' });
    setBusy(null);
    if (data?.preview) setShowPreview(data.preview.html);
  }

  async function recordPayment() {
    const dollars = Number(recAmount);
    if (!dollars || dollars <= 0) {
      setErr('Enter a valid payment amount');
      return;
    }
    setBusy('record');
    const data = await api({ action: 'record_payment', amountCents: Math.round(dollars * 100), method: recMethod, reference: recRef });
    setBusy(null);
    if (data) {
      setShowRecord(false);
      setRecAmount('');
      setRecRef('');
      onRefresh();
    }
  }

  async function markPaid() {
    setBusy('mark_paid');
    const data = await api({ action: 'mark_paid', ledgerConfirmed: mpConfirmed, ledgerReference: mpRef });
    setBusy(null);
    if (data) {
      setShowMarkPaid(false);
      setMpRef('');
      setMpConfirmed(false);
      onRefresh();
    }
  }

  async function sendReceipt() {
    setBusy('receipt');
    const data = await api({ action: 'receipt' });
    setBusy(null);
    setShowReceipt(false);
    if (data) onRefresh();
  }

  async function updateMethods(methods: PaymentMethod[]) {
    if (methods.length === 0) return;
    setBusy('methods');
    await api({ action: 'update_methods', paymentMethods: methods });
    setBusy(null);
    onRefresh();
  }

  function toggleMethod(m: PaymentMethod) {
    const cur = (invoice?.payment_methods ?? 'stripe').split(',').filter(Boolean) as PaymentMethod[];
    const next = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m];
    updateMethods(next);
  }

  /* ------------------------- no invoice yet ------------------------- */
  if (!invoice) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-700"><FileText className="h-4 w-4" /></span>
          <h3 className="text-base font-semibold text-gray-900">Final Invoice</h3>
          <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Not issued</span>
        </div>
        {lead.status !== 'completed' ? (
          <p className="text-sm text-gray-500">
            Mark this lead <strong>Completed</strong> first. Marking completed never auto-sends an invoice — you generate it
            here when the job is done.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Invoice amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <Input type="number" min="1" step="0.01" value={genAmount} onChange={(e) => setGenAmount(e.target.value)} placeholder="0.00" className="pl-7" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Due date (optional)</label>
              <Input type="date" value={genDue} onChange={(e) => setGenDue(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-500">Payment methods accepted</label>
              <div className="flex gap-4">
                {(['stripe', 'paypal'] as PaymentMethod[]).map((m) => (
                  <label key={m} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={genMethods.includes(m)} onChange={() => setGenMethods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))} className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                    {m === 'stripe' ? 'Stripe (card)' : 'PayPal'}
                  </label>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-500">Notes (optional)</label>
              <Input value={genNotes} onChange={(e) => setGenNotes(e.target.value)} placeholder="Line items, labor, parts…" />
            </div>
            {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
            <div className="sm:col-span-2">
              <Button onClick={generate} disabled={busy === 'generate'} className="bg-green-700 hover:bg-green-800">
                {busy === 'generate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Generate Final Invoice (draft)
              </Button>
            </div>
          </div>
        )}
      </section>
    );
  }

  /* --------------------------- invoice exists --------------------------- */
  const activeMethods = (invoice.payment_methods ?? 'stripe').split(',').filter(Boolean) as PaymentMethod[];
  const payLink = activeMethods.includes('stripe') ? invoice.pay_link_stripe : invoice.pay_link_paypal;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-700"><FileText className="h-4 w-4" /></span>
        <h3 className="text-base font-semibold text-gray-900">Final Invoice</h3>
        <span className="font-mono text-sm text-gray-500">{invoice.invoice_number}</span>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[invoice.status]}`}>{STATUS_LABEL[invoice.status]}</span>
      </div>

      {/* totals */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Total</p>
          <p className="mt-0.5 text-lg font-bold text-gray-900">{money(totalCents)}</p>
        </div>
        <div className="rounded-xl bg-green-50 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-green-600">Paid</p>
          <p className="mt-0.5 text-lg font-bold text-green-700">{money(paidCents)}</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-600">Balance</p>
          <p className="mt-0.5 text-lg font-bold text-amber-700">{money(balanceCents)}</p>
        </div>
      </div>

      {/* payment methods + links */}
      <div className="mb-4 rounded-xl border border-gray-100 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payment methods</p>
          <div className="flex gap-4">
            {(['stripe', 'paypal'] as PaymentMethod[]).map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700">
                <input type="checkbox" checked={activeMethods.includes(m)} onChange={() => toggleMethod(m)} disabled={busy === 'methods'} className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                {m === 'stripe' ? 'Stripe' : 'PayPal'}
              </label>
            ))}
          </div>
        </div>
        {payLink && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Link2 className="h-3.5 w-3.5 text-gray-400" />
            <span className="font-mono text-gray-600">https://hillcountryappliancerepair.com{payLink}</span>
            <button type="button" onClick={() => copyLink(payLink)} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 font-medium text-gray-600 hover:bg-gray-200">
              {copied === payLink ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
              {copied === payLink ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {/* payments ledger */}
      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Payments ledger</p>
        {payments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400">No payments recorded</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-medium text-gray-800">{money(p.amount_cents)}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 capitalize">{p.method}</span>
                {p.reference && <span className="font-mono text-[11px] text-gray-400">ref {p.reference}</span>}
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.ledger_confirmed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {p.ledger_confirmed ? 'ledger verified' : 'awaiting ledger'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {note && <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">{note}</p>}
      {err && <p className="mb-3 text-sm text-red-600">{err}</p>}

      {/* actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={preview} disabled={busy === 'preview'}>
          {busy === 'preview' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Eye className="mr-1.5 h-4 w-4" />}
          Preview
        </Button>
        {invoice.status !== 'invoice_paid' && invoice.status !== 'cancelled' && (
          <Button onClick={() => setShowSend(true)} className="bg-green-700 hover:bg-green-800">
            <Send className="mr-1.5 h-4 w-4" />
            {paidCents > 0 ? 'Resend Final Invoice' : 'Send Final Invoice'}
          </Button>
        )}
        {invoice.status !== 'invoice_paid' && invoice.status !== 'cancelled' && (
          <Button variant="outline" onClick={() => setShowRecord(true)}>
            <PlusCircle className="mr-1.5 h-4 w-4" />
            Record Payment
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => setShowMarkPaid(true)}
          disabled={!canPaid}
          title={canPaid ? 'Mark invoice paid after ledger confirmation' : 'Record payments covering the full balance first'}
        >
          <ShieldCheck className="mr-1.5 h-4 w-4" />
          Mark Invoice Paid
        </Button>
        {paidCents > 0 && (
          <Button variant="outline" onClick={() => setShowReceipt(true)}>
            <Receipt className="mr-1.5 h-4 w-4" />
            Send Receipt
          </Button>
        )}
      </div>

      {/* preview dialog */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPreview(null)} aria-hidden="true" />
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-3">
              <p className="text-sm font-semibold text-gray-900">Email preview (not sent)</p>
              <Button variant="outline" size="sm" onClick={() => setShowPreview(null)}>Close</Button>
            </div>
            <div className="p-4" dangerouslySetInnerHTML={{ __html: showPreview }} />
          </div>
        </div>
      )}

      {/* send confirm */}
      <ConfirmDialog
        open={showSend}
        title="Send Final Invoice"
        message={
          <>
            This emails <strong>{invoice.invoice_number}</strong> to <strong>{lead.email}</strong>.
            <span className="mt-2 block rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Email is simulated (dry-run) until customer email transport is configured in production — nothing is delivered during testing.
            </span>
          </>
        }
        confirmLabel="Send Invoice"
        busy={busy === 'send'}
        onConfirm={sendInvoice}
        onCancel={() => setShowSend(false)}
      />

      {/* record payment */}
      <ConfirmDialog
        open={showRecord}
        title="Record Payment"
        message={
          <div className="grid gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <Input type="number" min="0.01" step="0.01" value={recAmount} onChange={(e) => setRecAmount(e.target.value)} placeholder="0.00" className="pl-7" autoFocus />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Method</label>
              <select value={recMethod} onChange={(e) => setRecMethod(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500">
                <option value="stripe">Stripe</option>
                <option value="paypal">PayPal</option>
                <option value="manual">Manual / in-person</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Reference (tx ID, check #, cash receipt)</label>
              <Input value={recRef} onChange={(e) => setRecRef(e.target.value)} placeholder="Optional" />
            </div>
            <p className="text-xs text-gray-500">Partial payments are allowed. Recording never marks the invoice paid — you confirm the ledger next.</p>
          </div>
        }
        confirmLabel="Record Payment"
        busy={busy === 'record'}
        onConfirm={recordPayment}
        onCancel={() => setShowRecord(false)}
      />

      {/* mark paid */}
      <ConfirmDialog
        open={showMarkPaid}
        title="Mark Invoice Paid"
        message={
          <div className="grid gap-3">
            <p>
              Balance due: <strong>{money(balanceCents)}</strong>. Confirm the payment has cleared your bank/processor ledger before marking paid.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Ledger reference (Stripe/PayPal transaction ID)</label>
              <Input value={mpRef} onChange={(e) => setMpRef(e.target.value)} placeholder="e.g. pi_3… or PAYID-…" autoFocus />
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={mpConfirmed} onChange={(e) => setMpConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
              I verified this payment in the ledger (bank/Stripe/PayPal dashboard).
            </label>
          </div>
        }
        confirmLabel="Mark Paid"
        busy={busy === 'mark_paid'}
        danger={false}
        onConfirm={markPaid}
        onCancel={() => setShowMarkPaid(false)}
      />

      {/* receipt */}
      <ConfirmDialog
        open={showReceipt}
        title="Send Payment Receipt"
        message={
          <>
            Sends a branded receipt for <strong>{invoice.invoice_number}</strong> (paid to date {money(paidCents)}) to <strong>{lead.email}</strong>.
            <span className="mt-2 block rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Simulated (dry-run) until email transport is configured — nothing is delivered during testing.
            </span>
          </>
        }
        confirmLabel="Send Receipt"
        busy={busy === 'receipt'}
        onConfirm={sendReceipt}
        onCancel={() => setShowReceipt(false)}
      />
    </section>
  );
}

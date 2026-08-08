'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  User,
  Wrench,
  CalendarDays,
  Loader2,
  ArrowLeft,
  Phone,
  MapPin,
  Mail,
  CircleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { ActionBar, MobileActionBar, type BusyAction } from '@/components/admin/lead/ActionBar';
import { NotificationPanel } from '@/components/admin/lead/NotificationPanel';
import { ActivityTimeline } from '@/components/admin/lead/ActivityTimeline';
import { ConfirmDialog } from '@/components/admin/lead/ConfirmDialog';
import { InvoicePanel } from '@/components/admin/lead/InvoicePanel';
import { Input } from '@/components/ui/input';
import type {
  Lead,
  LeadDetailData,
  NotificationRow,
  ActivityRow,
  FinalInvoice,
  InvoicePaymentRow,
} from '@/lib/lead-workflow';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const TIME_SLOTS = ['8:00 AM', '10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM'];

export default function LeadDetail({ leadId }: { leadId: string }) {
  const [data, setData] = useState<LeadDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draftDate, setDraftDate] = useState('');
  const [draftTime, setDraftTime] = useState('');
  const [busy, setBusy] = useState<BusyAction>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // dialogs
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/lead/${leadId}`);
      if (!res.ok) throw new Error(`Failed to load lead (${res.status})`);
      const json = (await res.json()) as LeadDetailData;
      setData(json);
      setDraftDate(json.lead?.scheduled_date ?? '');
      setDraftTime(json.lead?.scheduled_time ?? '');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(`/api/admin/lead/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': 'hc-admin-dev-token-2026' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionErr(json.error ?? 'Request failed');
        return false;
      }
      setActionErr(null);
      await load();
      return true;
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  async function notify(type: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/admin/lead/${leadId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': 'hc-admin-dev-token-2026' },
        body: JSON.stringify({ type }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionErr(json.error ?? 'Request failed');
        return false;
      }
      setActionErr(null);
      await load();
      if (json.dryRun) flash('Simulated (dry run) — no email delivered');
      else flash('Email sent');
      return true;
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  async function handleAction(action: Exclude<BusyAction, null>) {
    setBusy(action);
    setActionErr(null);
    const lead = data?.lead ?? null;

    if (action === 'mark_scheduled') {
      const ok = await patch({ status: 'scheduled' });
      if (ok) flash('Lead marked scheduled (no email sent)');
    } else if (action === 'save_schedule') {
      const ok = await patch({ scheduled_date: draftDate, scheduled_time: draftTime });
      if (ok) flash('Schedule saved (no email sent)');
    } else if (action === 'confirmation') {
      await notify('confirmation');
    } else if (action === 'updated_schedule') {
      await notify('updated_schedule');
    } else if (action === 'reschedule') {
      setShowReschedule(true);
    } else if (action === 'cancel') {
      setShowCancel(true);
    } else if (action === 'cancellation') {
      await notify('cancellation');
    } else if (action === 'completed') {
      const ok = await patch({ status: 'completed' });
      if (ok) flash('Marked completed — final invoice is generated manually, never auto-sent');
    }
    setBusy(null);
  }

  async function confirmReschedule() {
    if (!draftDate || !draftTime) {
      setActionErr('Pick a date and time');
      return;
    }
    setBusy('reschedule');
    const ok = await patch({ scheduled_date: draftDate, scheduled_time: draftTime });
    setBusy(null);
    if (ok) {
      setShowReschedule(false);
      flash('Schedule updated (no email sent)');
    }
  }

  async function confirmCancel() {
    setBusy('cancel');
    const ok = await patch({ status: 'cancelled', cancelReason });
    setBusy(null);
    if (ok) {
      setShowCancel(false);
      setCancelReason('');
      flash('Lead cancelled — send the cancellation notice when ready');
    }
  }

  const call = () => {
    if (typeof window !== 'undefined') window.location.href = 'tel:8303530845';
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-green-700" />
      </div>
    );
  }

  if (loadError || !data || !data.lead) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <CircleAlert className="h-8 w-8 text-red-500" />
        <p className="text-sm text-gray-600">{loadError ?? 'Lead not found'}</p>
        <Link href="/admin/requests" className="text-sm font-medium text-green-700 hover:underline">
          Back to requests
        </Link>
      </div>
    );
  }

  const lead = data.lead as Lead;
  const notifications = data.notifications as NotificationRow[];
  const activities = data.activities as ActivityRow[];
  const invoice = data.invoice as FinalInvoice | null;
  const invoicePayments = data.invoicePayments as InvoicePaymentRow[];

  return (
    <div className="pb-24 sm:pb-8">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/admin/requests" className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" /> Requests
        </Link>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{lead.name}</h1>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[lead.status]}`}>{STATUS_LABEL[lead.status]}</span>
        {toast && <span className="ml-auto rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">{toast}</span>}
      </div>

      {/* action bar */}
      <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <ActionBar lead={lead} busy={busy} onAction={handleAction} onCall={call} />
        {actionErr && <p className="mt-2 text-sm text-red-600">{actionErr}</p>}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* left column */}
        <div className="space-y-5 lg:col-span-2">
          {/* customer card */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-700"><User className="h-4 w-4" /></span>
              <h3 className="text-base font-semibold text-gray-900">Customer</h3>
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-gray-400">Email</dt><dd className="flex items-center gap-1 text-gray-800"><Mail className="h-3.5 w-3.5 text-gray-400" />{lead.email}</dd></div>
              <div><dt className="text-xs text-gray-400">Phone</dt><dd className="flex items-center gap-1 text-gray-800"><Phone className="h-3.5 w-3.5 text-gray-400" />{lead.phone ?? '—'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-gray-400">Address</dt><dd className="flex items-start gap-1 text-gray-800"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />{lead.address ?? '—'}</dd></div>
            </dl>
          </section>

          {/* request card */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-700"><Wrench className="h-4 w-4" /></span>
              <h3 className="text-base font-semibold text-gray-900">Repair Request</h3>
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-gray-400">Appliance</dt><dd className="text-gray-800">{lead.appliance_type ?? '—'}</dd></div>
              <div><dt className="text-xs text-gray-400">Brand / Model</dt><dd className="text-gray-800">{lead.brand ?? '—'}{lead.model ? ` / ${lead.model}` : ''}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-gray-400">Problem</dt><dd className="whitespace-pre-wrap text-gray-800">{lead.description ?? '—'}</dd></div>
              <div><dt className="text-xs text-gray-400">Requested</dt><dd className="text-gray-800">{lead.created_at ? new Date(lead.created_at + (lead.created_at.includes('T') ? '' : 'Z')).toLocaleString() : '—'}</dd></div>
              <div><dt className="text-xs text-gray-400">Preferred</dt><dd className="text-gray-800">{lead.preferred_date ?? '—'}{lead.preferred_time ? ` at ${lead.preferred_time}` : ''}</dd></div>
            </dl>
          </section>

          {/* appointment card */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-700"><CalendarDays className="h-4 w-4" /></span>
              <h3 className="text-base font-semibold text-gray-900">Appointment</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Date</label>
                <Input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Time</label>
                <select value={draftTime} onChange={(e) => setDraftTime(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500">
                  <option value="">Select time…</option>
                  {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
              <span>Appointment window: {lead.appointment_local_start ? lead.appointment_local_start : lead.scheduled_date ? `${lead.scheduled_date} ${lead.scheduled_time ?? ''}` : 'not set'}</span>
              {lead.confirmed_at && <span className="text-green-600">Confirmed {new Date(lead.confirmed_at + (lead.confirmed_at.includes('T') ? '' : 'Z')).toLocaleString()}</span>}
              {lead.cancelled_at && <span className="text-red-500">Cancelled {new Date(lead.cancelled_at + (lead.cancelled_at.includes('T') ? '' : 'Z')).toLocaleString()}</span>}
            </div>
          </section>

          {/* final invoice */}
          <InvoicePanel lead={lead} invoice={invoice} payments={invoicePayments} onRefresh={load} />

          {/* activity timeline */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-900">Activity</h3>
            <ActivityTimeline activities={activities} />
          </section>
        </div>

        {/* right column */}
        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-900">Email Log</h3>
            <NotificationPanel notifications={notifications} />
          </section>
        </div>
      </div>

      {/* reschedule dialog */}
      <ConfirmDialog
        open={showReschedule}
        title="Reschedule Appointment"
        message={
          <div className="grid gap-3">
            <p>Pick the new appointment time. This saves the change — it does <strong>not</strong> email the customer.</p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">New date</label>
              <Input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">New time</label>
              <select value={draftTime} onChange={(e) => setDraftTime(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500">
                <option value="">Select time…</option>
                {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        }
        confirmLabel="Save New Time"
        busy={busy === 'reschedule'}
        onConfirm={confirmReschedule}
        onCancel={() => setShowReschedule(false)}
      />

      {/* cancel dialog */}
      <ConfirmDialog
        open={showCancel}
        title="Cancel Appointment"
        message={
          <div className="grid gap-3">
            <p>This cancels the appointment. It does <strong>not</strong> email the customer — you send the cancellation notice next.</p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Reason (optional)</label>
              <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. customer requested, parts unavailable…" />
            </div>
          </div>
        }
        confirmLabel="Cancel Appointment"
        danger
        busy={busy === 'cancel'}
        onConfirm={confirmCancel}
        onCancel={() => setShowCancel(false)}
      />

      <MobileActionBar lead={lead} busy={busy} onAction={handleAction} onCall={call} />
    </div>
  );
}

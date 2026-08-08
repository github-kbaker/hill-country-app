import { NextResponse } from 'next/server';
import { query, escape } from '@/lib/db';
import { isAdminRequest } from '@/lib/admin-auth';
import type {
  Lead,
  LeadStatus,
  LeadDetailData,
  NotificationRow,
  ActivityRow,
  PaymentRow,
  FinalInvoice,
  InvoicePaymentRow,
} from '@/lib/lead-workflow';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: LeadStatus[] = ['pending', 'scheduled', 'completed', 'cancelled'];

function getLead(id: number): Lead | null {
  const rows = query(`SELECT * FROM app_repair_requests WHERE id = ${id}`);
  return (rows as Lead[])[0] ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }
  const lead = getLead(id);
  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const data: LeadDetailData = {
    lead,
    payments: query(
      `SELECT * FROM app_payments WHERE invoice_number IN (SELECT invoice_number FROM app_final_invoices WHERE request_id = ${id}) ORDER BY created_at DESC`
    ) as PaymentRow[],
    notifications: query(
      `SELECT * FROM app_schedule_notifications WHERE request_id = ${id} ORDER BY sent_at DESC, id DESC`
    ) as NotificationRow[],
    activities: query(
      `SELECT * FROM app_lead_activities WHERE request_id = ${id} ORDER BY id DESC`
    ) as ActivityRow[],
    invoice: (query(
      `SELECT * FROM app_final_invoices WHERE request_id = ${id} ORDER BY id DESC LIMIT 1`
    ) as FinalInvoice[])[0] ?? null,
    invoicePayments: query(
      `SELECT * FROM app_invoice_payments WHERE request_id = ${id} ORDER BY id DESC`
    ) as InvoicePaymentRow[],
  };

  return NextResponse.json(data);
}

export async function PATCH(
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

  const lead = getLead(id);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  // Status change (Mark Scheduled / Mark Completed / Cancel) — NEVER emails.
  if (typeof body.status === 'string') {
    const status = body.status as LeadStatus;
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status '${status}'` }, { status: 400 });
    }
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const sets: string[] = [`status = ${escape(status)}`, `updated_at = ${escape(now)}`];
    let action = 'status_changed';
    let detail = `Status changed to ${status}`;

    if (status === 'cancelled') {
      sets.push(`cancelled_at = ${escape(now)}`);
      const reason = typeof body.cancelReason === 'string' ? body.cancelReason.trim() : '';
      if (reason) {
        sets.push(`cancel_reason = ${escape(reason)}`);
        detail = `Lead cancelled${reason ? `: ${reason}` : ''}`;
      }
    } else if (status === 'completed') {
      // Marking completed MUST NOT auto-generate or auto-send an invoice.
      action = 'completed';
      detail = 'Job marked completed (invoice must be generated manually)';
    } else if (status === 'scheduled') {
      action = 'marked_scheduled';
      detail = 'Lead marked scheduled';
    }

    query(`UPDATE app_repair_requests SET ${sets.join(', ')} WHERE id = ${id}`);
    query(
      `INSERT INTO app_lead_activities (request_id, action, detail) VALUES (${id}, ${escape(action)}, ${escape(detail)})`
    );
    return NextResponse.json({ ok: true, lead: getLead(id) });
  }

  // Schedule persistence (Save Schedule) — NEVER emails.
  if (typeof body.scheduled_date === 'string' || typeof body.scheduled_time === 'string') {
    if (lead.status === 'cancelled' || lead.status === 'completed') {
      return NextResponse.json({ error: 'Cannot change schedule on a completed or cancelled lead' }, { status: 400 });
    }
    const date = typeof body.scheduled_date === 'string' ? body.scheduled_date.trim() : (lead.scheduled_date ?? '');
    const time = typeof body.scheduled_time === 'string' ? body.scheduled_time.trim() : (lead.scheduled_time ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'scheduled_date must be YYYY-MM-DD' }, { status: 400 });
    }
    if (!/^\d{1,2}(:\d{2})?\s*(AM|PM)$/i.test(time)) {
      return NextResponse.json({ error: 'scheduled_time must be a time slot like 8:00 AM' }, { status: 400 });
    }
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    query(
      `UPDATE app_repair_requests SET scheduled_date = ${escape(date)}, scheduled_time = ${escape(time)}, updated_at = ${escape(now)} WHERE id = ${id}`
    );
    query(
      `INSERT INTO app_lead_activities (request_id, action, detail) VALUES (${id}, 'schedule_saved', ${escape(`Schedule set to ${date} at ${time}`)})`
    );
    return NextResponse.json({ ok: true, lead: getLead(id) });
  }

  return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
}

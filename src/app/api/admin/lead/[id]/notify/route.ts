import { NextResponse } from 'next/server';
import { query, escape } from '@/lib/db';
import { isAdminRequest } from '@/lib/admin-auth';
import { createCustomerTransport, sendEmail, BRAND_GREEN, BRAND_BLACK } from '@/lib/email';
import { buildAppointmentIcs } from '@/lib/ics';
import { getAppointmentWindow, formatDateOnly } from '@/lib/timezone';
import type { Lead } from '@/lib/lead-workflow';

export const dynamic = 'force-dynamic';

const NOTIFY_TYPES = ['confirmation', 'updated_schedule', 'cancellation'] as const;
type NotifyType = (typeof NOTIFY_TYPES)[number];

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function shell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;border:1px solid #e4e4e7;">
<tr><td style="background:${BRAND_BLACK};padding:24px 32px;"><span style="font-family:Arial;font-size:18px;font-weight:bold;color:#fff;">HILL COUNTRY</span><span style="font-family:Arial;font-size:12px;font-weight:bold;color:${BRAND_GREEN};display:block;margin-top:2px;">APPLIANCE REPAIR</span></td></tr>
<tr><td style="background:${BRAND_GREEN};padding:16px 32px;"><span style="font-family:Arial;font-size:16px;font-weight:bold;color:#fff;">${esc(title)}</span></td></tr>
<tr><td style="padding:32px;font-family:Arial;color:#1a1a1a;font-size:14px;line-height:1.6;">${bodyHtml}</td></tr>
<tr><td style="background:#f4f4f5;padding:16px 32px;border-top:1px solid #e4e4e7;"><p style="margin:0;font-family:Arial;font-size:12px;color:#71717a;">Hill Country Appliance Repair &middot; Fredericksburg &amp; Kerrville, TX<br/><a href="tel:830-353-0845" style="color:${BRAND_GREEN};font-weight:bold;text-decoration:none;">830-353-0845</a></p></td></tr>
</table></td></tr></table></body></html>`;
}

function renderNotifyEmail(type: NotifyType, lead: Lead, windowLabel: string) {
  const firstName = lead.name.split(' ')[0] || lead.name;
  const phone = '<a href="tel:830-353-0845" style="color:' + BRAND_GREEN + ';font-weight:bold;text-decoration:none;">830-353-0845</a>';
  if (type === 'confirmation') {
    const title = 'Your Appointment Is Confirmed';
    const body = `
      <p style="margin:0 0 16px;">Hi ${esc(firstName)},</p>
      <p style="margin:0 0 16px;">Your ${esc(lead.appliance_type ?? 'appliance')} repair is scheduled:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8f5e9;border:1px solid ${BRAND_GREEN};border-radius:8px;margin:16px 0;"><tr><td style="padding:16px 20px;font-family:Arial;">
        <p style="margin:0 0 6px;font-size:13px;">Appointment</p>
        <p style="margin:0 0 4px;font-size:15px;font-weight:bold;">${esc(windowLabel)}</p>
        <p style="margin:0;font-size:13px;color:#1a1a1a;">Service area: ${esc(lead.address ?? 'Hill Country, TX')}</p>
      </td></tr></table>
      <p style="margin:0 0 16px;">A calendar invite is attached. If you need to reschedule, call ${phone}.</p>
      <p style="margin:0;">Thanks,<br/>Hill Country Appliance Repair</p>`;
    return { title, html: shell(title, body), text: `Hi ${firstName},\n\nYour ${lead.appliance_type ?? 'appliance'} repair is confirmed for ${windowLabel}.\n\nIf you need to reschedule, call 830-353-0845.\n\nHill Country Appliance Repair` };
  }
  if (type === 'updated_schedule') {
    const title = 'Your Appointment Has Been Updated';
    const body = `
      <p style="margin:0 0 16px;">Hi ${esc(firstName)},</p>
      <p style="margin:0 0 16px;">Your appointment was updated. The new time is:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8f5e9;border:1px solid ${BRAND_GREEN};border-radius:8px;margin:16px 0;"><tr><td style="padding:16px 20px;font-family:Arial;">
        <p style="margin:0 0 6px;font-size:13px;">Updated appointment</p>
        <p style="margin:0 0 4px;font-size:15px;font-weight:bold;">${esc(windowLabel)}</p>
      </td></tr></table>
      <p style="margin:0;">Questions? Call ${phone}.</p>`;
    return { title, html: shell(title, body), text: `Hi ${firstName},\n\nYour appointment was updated to ${windowLabel}.\n\nQuestions? Call 830-353-0845.` };
  }
  const title = 'Appointment Cancellation Notice';
  const body = `
    <p style="margin:0 0 16px;">Hi ${esc(firstName)},</p>
    <p style="margin:0 0 16px;">We're sorry, but your appointment${lead.scheduled_date ? ` for ${esc(formatDateOnly(new Date(lead.scheduled_date + 'T00:00:00')))}` : ''} has been cancelled.</p>
    ${lead.cancel_reason ? `<p style="margin:0 0 16px;">Reason: ${esc(lead.cancel_reason)}</p>` : ''}
    <p style="margin:0 0 16px;">If you'd like to reschedule, call ${phone}.</p>
    <p style="margin:0;">Thanks,<br/>Hill Country Appliance Repair</p>`;
  return { title, html: shell(title, body), text: `Hi ${firstName},\n\nYour appointment has been cancelled.${lead.cancel_reason ? ` Reason: ${lead.cancel_reason}` : ''}\n\nTo reschedule, call 830-353-0845.` };
}

function isDryRunConfigured(): boolean {
  return process.env.EMAIL_DRY_RUN === 'true';
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

  let body: { type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const type = body.type as NotifyType;
  if (!NOTIFY_TYPES.includes(type)) {
    return NextResponse.json({ error: `Invalid notification type '${type}'` }, { status: 400 });
  }

  const rows = (await query(`SELECT * FROM app_repair_requests WHERE id = ${id}`)) as Lead[];
  const lead = rows[0];
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  if (type === 'confirmation' && lead.status !== 'scheduled') {
    return NextResponse.json({ error: 'Confirmation requires a scheduled lead' }, { status: 400 });
  }
  if (type === 'updated_schedule' && !lead.confirmed_at) {
    return NextResponse.json({ error: 'Updated-schedule notice requires a previously confirmed appointment' }, { status: 400 });
  }
  if (type === 'cancellation' && lead.status !== 'cancelled') {
    return NextResponse.json({ error: 'Cancellation notice requires a cancelled lead' }, { status: 400 });
  }
  if (!lead.email) {
    return NextResponse.json({ error: 'Lead has no email address' }, { status: 400 });
  }

  const window = getAppointmentWindow(lead.scheduled_date ?? '', lead.scheduled_time ?? '');
  const { title, html, text } = renderNotifyEmail(type, lead, window?.label ?? `${lead.scheduled_date} ${lead.scheduled_time}`);

  const icsAttachment =
    type === 'confirmation' || type === 'updated_schedule'
      ? buildAppointmentIcs({
          uid: `hc-${lead.id}-${type}-${Date.now()}@hillcountryappliancerepair.com`,
          summary: `${lead.appliance_type ?? 'Appliance'} Repair — Hill Country Appliance Repair`,
          description: lead.description ?? '',
          location: lead.address ?? '',
          start: window?.start ?? new Date(`${lead.scheduled_date}T12:00:00`).toISOString(),
          end: window?.end ?? new Date(`${lead.scheduled_date}T12:00:00`).toISOString(),
          attendeeName: lead.name,
          attendeeEmail: lead.email,
        })
      : undefined;

  const dryRun = isDryRunConfigured();
  const transportReady =
    Boolean(process.env.RESEND_API_KEY) ||
    Boolean(process.env.SCHEDULE_EMAIL_HOST && process.env.SCHEDULE_EMAIL_USER && process.env.SCHEDULE_EMAIL_PASS);

  let status = 'sent';
  let error: string | null = null;
  let messageId: string | null = null;

  if (dryRun || !transportReady) {
    status = 'dry_run';
    error = dryRun ? 'EMAIL_DRY_RUN=true — simulated, not delivered' : 'Customer email transport not configured — simulated, not delivered';
  } else {
    try {
      const transport = createCustomerTransport();
      const result = await sendEmail(transport, {
        to: lead.email,
        subject: title,
        html,
        text,
        attachments: icsAttachment ? [{ filename: 'appointment.ics', content: icsAttachment }] : undefined,
      });
      messageId = result.messageId ?? null;
    } catch (err) {
      status = 'failed';
      error = err instanceof Error ? err.message : String(err);
    }
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const inserted = (await query(
    `INSERT INTO app_schedule_notifications (request_id, type, recipient_email, status, error, sent_at) VALUES (${id}, ${escape(type)}, ${escape(lead.email)}, ${escape(status)}, ${escape(error)}, ${escape(now)}) RETURNING *`
  )) as Array<{ id: number; type: string; recipient_email: string | null; status: string; error: string | null; sent_at: string | null }>;
  const notification = inserted[0];

  await query(
    `INSERT INTO app_lead_activities (request_id, action, detail) VALUES (${id}, ${escape(status === 'dry_run' ? 'email_dry_run' : status === 'failed' ? 'email_failed' : 'email_sent')}, ${escape(`${type} → ${lead.email}${error ? ` (${error})` : ''}${messageId ? ` (${messageId})` : ''}`)})`
  );

  if (status === 'failed') {
    return NextResponse.json({ ok: false, dryRun: false, error, notification }, { status: 502 });
  }
  return NextResponse.json({ ok: true, dryRun: status === 'dry_run', notification });
}

/**
 * Email transports + branded templates for invoice notifications.
 *
 * Transport separation (same pattern as the schedule feature):
 * - Business/admin notifications   → EMAIL_* SMTP (createEmailTransport)
 * - Customer-facing invoice mail   → RESEND_API_KEY or SCHEDULE_EMAIL_* SMTP
 *                                    (createCustomerTransport) — business
 *                                    EMAIL_* is NEVER used for customer mail.
 *
 * Transports fail closed: if unconfigured, sendMail rejects with a clear error
 * so notifications are recorded as 'failed' and can be retried — never silently
 * dropped, and never sent to a real customer without configuration.
 */

import nodemailer from 'nodemailer';
import type { TransportOptions } from 'nodemailer';

export const BRAND_GREEN = '#2e7d32';
export const BRAND_BLACK = '#1a1a1a';

export interface MailRecipient {
  from?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

export interface TransportLike {
  sendMail: (mail: MailRecipient) => Promise<{ messageId?: string; accepted?: unknown; rejected?: unknown[] }>;
}

export type SendResult = { messageId?: string; accepted: boolean };

/** Business/admin SMTP transport from EMAIL_*. Fail-closed when unconfigured. */
export function createEmailTransport(): TransportLike {
  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!host || !user || !pass) {
    return failClosedTransport('EMAIL_HOST, EMAIL_USER, and EMAIL_PASS');
  }
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_PORT === '465',
    auth: { user, pass },
  } as TransportOptions);
}

/** Customer-facing transport: Resend API or dedicated SCHEDULE_EMAIL_* SMTP. */
export function createCustomerTransport(): TransportLike {
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    return createResendTransport(resendKey);
  }
  const host = process.env.SCHEDULE_EMAIL_HOST;
  const user = process.env.SCHEDULE_EMAIL_USER;
  const pass = process.env.SCHEDULE_EMAIL_PASS;
  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port: parseInt(process.env.SCHEDULE_EMAIL_PORT || '587', 10),
      secure: process.env.SCHEDULE_EMAIL_PORT === '465',
      auth: { user, pass },
    } as TransportOptions);
  }
  return failClosedTransport('RESEND_API_KEY or SCHEDULE_EMAIL_HOST/USER/PASS');
}

/** Resend-compatible HTTP transport (no SDK dependency; fetch-based). */
export function createResendTransport(apiKey: string): TransportLike {
  return {
    async sendMail(mail: MailRecipient) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: mail.from,
          to: [mail.to],
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          attachments: mail.attachments?.map((a) => ({
            filename: a.filename,
            content: a.content.toString('base64'),
          })),
        }),
      });
      if (!res.ok) {
        throw new Error(`Resend error ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      const json: { id?: string } = await res.json().catch(() => ({}));
      return { messageId: json.id, accepted: true };
    },
  };
}

function failClosedTransport(required: string): TransportLike {
  return {
    async sendMail() {
      throw new Error(`Email transport is not configured: set ${required}.`);
    },
  };
}

export async function sendEmail(transport: TransportLike, mail: MailRecipient): Promise<SendResult> {
  const info = await transport.sendMail(mail);
  const accepted = Array.isArray(info?.accepted) ? info.accepted.length > 0 : info?.accepted === true;
  const rejected = Array.isArray(info?.rejected) ? info.rejected.length : 0;
  return {
    messageId: typeof info?.messageId === 'string' ? info.messageId : undefined,
    accepted: accepted || rejected === 0,
  };
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function shell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
<tr><td style="background-color:${BRAND_BLACK};padding:24px 32px;"><span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">HILL COUNTRY</span><span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:${BRAND_GREEN};display:block;margin-top:2px;">APPLIANCE REPAIR</span></td></tr>
<tr><td style="background-color:${BRAND_GREEN};padding:16px 32px;"><span style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;">${esc(title)}</span></td></tr>
<tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.6;">${bodyHtml}</td></tr>
<tr><td style="background-color:#f4f4f5;padding:16px 32px;border-top:1px solid #e4e4e7;"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#71717a;">Hill Country Appliance Repair &middot; Fredericksburg &amp; Kerrville, TX<br/><a href="tel:830-353-0845" style="color:${BRAND_GREEN};font-weight:bold;text-decoration:none;">830-353-0845</a></p></td></tr>
</table></td></tr></table></body></html>`;
}

export interface InvoiceEmailData {
  customerName: string;
  invoiceNumber: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  dueDate?: string;
  paymentLink?: string;
}

export interface InvoiceEmailContent {
  subject: string;
  html: string;
  text: string;
}

/** Branded FINAL INVOICE email (HTML + plain text). */
export function renderFinalInvoiceEmail(data: InvoiceEmailData): InvoiceEmailContent {
  const subject = `Final Invoice ${data.invoiceNumber} — Hill Country Appliance Repair`;
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${esc(data.customerName)},</p>
    <p style="margin:0 0 16px;">Your appliance repair is complete. Please find your final invoice below.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#e8f5e9;border:1px solid ${BRAND_GREEN};border-radius:8px;margin:16px 0;">
      <tr><td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;">
        <p style="margin:0 0 6px;font-size:13px;color:#1a1a1a;">Invoice <strong>${esc(data.invoiceNumber)}</strong>${data.dueDate ? ` &middot; due ${esc(data.dueDate)}` : ''}</p>
        <p style="margin:0 0 4px;font-size:15px;color:#1a1a1a;">Total: <strong>${money(data.totalCents)}</strong></p>
        ${data.paidCents > 0 ? `<p style="margin:0 0 4px;font-size:14px;color:#1a1a1a;">Paid: ${money(data.paidCents)}</p>` : ''}
        <p style="margin:0;font-size:15px;color:${BRAND_GREEN};font-weight:bold;">Balance due: ${money(data.balanceCents)}</p>
      </td></tr>
    </table>
    ${data.paymentLink ? `<p style="margin:0 0 16px;">Pay securely online: <a href="${esc(data.paymentLink)}" style="color:${BRAND_GREEN};font-weight:bold;">${esc(data.paymentLink)}</a></p>` : ''}
    <p style="margin:0;">Questions? Call us at <a href="tel:830-353-0845" style="color:${BRAND_GREEN};font-weight:bold;text-decoration:none;">830-353-0845</a>.</p>
  `;
  const bodyText = `
Hi ${data.customerName},

Your appliance repair is complete. Final invoice ${data.invoiceNumber}${data.dueDate ? ` (due ${data.dueDate})` : ''}:
  Total: ${money(data.totalCents)}
  ${data.paidCents > 0 ? `Paid: ${money(data.paidCents)}\n` : ''}Balance due: ${money(data.balanceCents)}
${data.paymentLink ? `\nPay securely online: ${data.paymentLink}\n` : ''}
Questions? Call 830-353-0845.

Thank you,
Hill Country Appliance Repair
  `.trim();
  return { subject, html: shell(subject, bodyHtml), text: bodyText };
}

/** Branded RECEIPT email (full or partial payment). */
export function renderReceiptEmail(data: InvoiceEmailData): InvoiceEmailContent {
  const subject = `Payment Receipt ${data.invoiceNumber} — Hill Country Appliance Repair`;
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${esc(data.customerName)},</p>
    <p style="margin:0 0 16px;">We received your payment. Here is your receipt:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#e8f5e9;border:1px solid ${BRAND_GREEN};border-radius:8px;margin:16px 0;">
      <tr><td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;">
        <p style="margin:0 0 6px;font-size:13px;color:#1a1a1a;">Invoice <strong>${esc(data.invoiceNumber)}</strong></p>
        <p style="margin:0 0 4px;font-size:15px;color:#1a1a1a;">Total: ${money(data.totalCents)}</p>
        <p style="margin:0 0 4px;font-size:14px;color:#1a1a1a;">Paid to date: <strong>${money(data.paidCents)}</strong></p>
        ${data.balanceCents > 0 ? `<p style="margin:0;font-size:15px;color:#1a1a1a;">Remaining balance: ${money(data.balanceCents)}</p>` : '<p style="margin:0;font-size:15px;color:#1a1a1a;font-weight:bold;">Paid in full — thank you!</p>'}
      </td></tr>
    </table>
    <p style="margin:0;">Questions? Call <a href="tel:830-353-0845" style="color:${BRAND_GREEN};font-weight:bold;text-decoration:none;">830-353-0845</a>.</p>
  `;
  const bodyText = `
Hi ${data.customerName},

We received your payment for invoice ${data.invoiceNumber}.
  Total: ${money(data.totalCents)}
  Paid to date: ${money(data.paidCents)}
  ${data.balanceCents > 0 ? `Remaining balance: ${money(data.balanceCents)}` : 'Paid in full — thank you!'}

Questions? Call 830-353-0845.

Thank you,
Hill Country Appliance Repair
  `.trim();
  return { subject, html: shell(subject, bodyHtml), text: bodyText };
}

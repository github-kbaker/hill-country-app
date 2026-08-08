import { NextResponse } from 'next/server';
import { getPayPalConfig, verifyPayPalWebhookSignature, normalizePayPalWebhookEvent } from '@/lib/payments/paypal';
import { InvoiceService } from '@/lib/invoice';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * POST /api/paypal/webhook
 * Verifies the PayPal transmission signature, then applies PAYMENT.CAPTURE
 * .COMPLETED events to the invoice ledger idempotently (provider_event_id is
 * UNIQUE, so redeliveries can never double-apply). Sandbox only unless
 * PAYPAL_MODE=live is explicitly set.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();

  const config = getPayPalConfig();
  if (!config) {
    return NextResponse.json({ error: 'PayPal webhook is not configured' }, { status: 503 });
  }

  const h = (name: string) => req.headers.get(name) ?? '';
  const transmission = {
    transmissionId: h('paypal-transmission-id'),
    transmissionTime: h('paypal-transmission-time'),
    transmissionSig: h('paypal-transmission-sig'),
    certUrl: h('paypal-cert-url'),
    authAlgo: h('paypal-auth-algo'),
  };
  if (!transmission.transmissionId || !transmission.transmissionSig || !transmission.certUrl) {
    return NextResponse.json({ error: 'Missing PayPal transmission headers' }, { status: 400 });
  }

  let valid = false;
  try {
    valid = await verifyPayPalWebhookSignature(config, transmission, rawBody);
  } catch (err) {
    console.error('[paypal:webhook] verification error:', (err as Error).message);
  }
  if (!valid) {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const payment = normalizePayPalWebhookEvent(payload);
  if (!payment) {
    // Unhandled event type — acknowledge so PayPal stops retrying.
    return NextResponse.json({ received: true });
  }
  if (!payment.invoiceId) {
    console.error('[paypal:webhook] PAYMENT.CAPTURE.COMPLETED without custom_id:', payload.id);
    return NextResponse.json({ received: true });
  }

  try {
    const service = new InvoiceService({ db: { query } });
    const result = await service.applyPayment(payment.invoiceId, payment);
    return NextResponse.json({ received: true, applied: result.applied, invoice: result.invoice.invoice_number });
  } catch (error: any) {
    console.error('[paypal:webhook] ledger update failed:', error.message);
    return NextResponse.json({ error: 'Ledger update failed' }, { status: 500 });
  }
}

/**
 * PayPal provider (SANDBOX by default — PAYPAL_MODE must be 'sandbox' unless a
 * live environment is explicitly configured). REST v2 orders + webhook
 * signature verification, all over injectable fetch so tests never touch the
 * network.
 *
 * Amounts cross the boundary as 2-decimal USD strings (PayPal API format);
 * canonical ledger math stays in integer cents (see payments/provider.ts).
 */

import crypto from 'node:crypto';
import type { NormalizedPayment } from '@/lib/payments/provider';
import { centsToDollars, dollarsToCents } from '@/lib/payments/provider';

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  mode: 'sandbox' | 'live';
  webhookId: string;
}

export function getPayPalConfig(): PayPalConfig | null {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!clientId || !clientSecret || !webhookId) return null;
  return {
    clientId,
    clientSecret,
    mode: process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox',
    webhookId,
  };
}

export function payPalBaseUrl(mode: 'sandbox' | 'live'): string {
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<any>; text: () => Promise<string> }>;

const defaultFetch: FetchLike = async (url, init) => {
  const res = await fetch(url, init);
  return {
    ok: res.ok,
    status: res.status,
    json: () => res.json(),
    text: () => res.text(),
  };
};

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

/** OAuth2 client_credentials token (cached per-process). */
export async function getPayPalAccessToken(config: PayPalConfig, fetchImpl: FetchLike = defaultFetch): Promise<string> {
  const res = await fetchImpl(`${payPalBaseUrl(config.mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(config.clientId, config.clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (!json.access_token) throw new Error('PayPal auth response missing access_token');
  return json.access_token;
}

export interface PayPalCreateOrderParams {
  amountCents: number;
  invoiceId: number;
  invoiceNumber: string;
  returnUrl: string;
  cancelUrl: string;
  brandName?: string;
}

export interface PayPalOrderResult {
  id: string;
  approveUrl: string;
  status: string;
}

export async function createPayPalOrder(config: PayPalConfig, params: PayPalCreateOrderParams, fetchImpl: FetchLike = defaultFetch): Promise<PayPalOrderResult> {
  const token = await getPayPalAccessToken(config, fetchImpl);
  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: String(params.invoiceId),
        custom_id: String(params.invoiceId),
        invoice_id: params.invoiceNumber,
        description: `Appliance Repair — Invoice #${params.invoiceNumber}`,
        amount: {
          currency_code: 'USD',
          value: centsToDollars(params.amountCents),
        },
      },
    ],
    application_context: {
      brand_name: params.brandName ?? 'Hill Country Appliance Repair',
      user_action: 'PAY_NOW',
      shipping_preference: 'NO_SHIPPING',
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl,
    },
  };
  const res = await fetchImpl(`${payPalBaseUrl(config.mode)}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PayPal create order failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const approve = (json.links ?? []).find((l: any) => l.rel === 'approve');
  return { id: json.id, approveUrl: approve?.href ?? '', status: json.status };
}

export async function capturePayPalOrder(config: PayPalConfig, orderId: string, fetchImpl: FetchLike = defaultFetch): Promise<{ captureId: string; status: string; amountCents: number; currency: string; customId?: string }> {
  const token = await getPayPalAccessToken(config, fetchImpl);
  const res = await fetchImpl(`${payPalBaseUrl(config.mode)}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`PayPal capture failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const capture = json.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture) throw new Error('PayPal capture response missing capture');
  return {
    captureId: capture.id,
    status: capture.status,
    amountCents: dollarsToCents(capture.amount?.value ?? '0'),
    currency: (capture.amount?.currency_code ?? 'USD').toUpperCase(),
    customId: json.purchase_units?.[0]?.custom_id,
  };
}

// ---------------------------------------------------------------------------
// Webhook signature verification (v1 transmission verification, per PayPal docs)
// ---------------------------------------------------------------------------

export interface PayPalWebhookHeaders {
  transmissionId: string;
  transmissionTime: string;
  transmissionSig: string;
  certUrl: string;
  authAlgo: string;
}

export interface VerifySignatureDeps {
  fetchImpl?: FetchLike;
  /** Inject for deterministic tests; defaults to real RSA verification. */
  verify?: (publicKeyPem: string, signatureBase64: string, data: string) => boolean;
  /** Clock for the transmission-time tolerance check. */
  now?: () => Date;
  /** Max allowed skew between transmission time and now. */
  maxAgeMs?: number;
  /** Simple cert cache keyed by URL. */
  certCache?: Map<string, string>;
}

/** Pure RSA-SHA256 verification (node:crypto). */
export function verifyRsaSignature(publicKeyPem: string, signatureBase64: string, data: string): boolean {
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(data, 'utf8');
    return verifier.verify(publicKeyPem, signatureBase64, 'base64');
  } catch {
    return false;
  }
}

/**
 * Verify a PayPal webhook transmission. Returns true only when:
 *  1. the RSA-SHA256 signature over `auth_algo|transmission_id|transmission_time|webhook_id|rawBody`
 *     validates against the public key from certUrl, and
 *  2. the transmission time is within tolerance of now.
 */
export async function verifyPayPalWebhookSignature(
  config: PayPalConfig,
  headers: PayPalWebhookHeaders,
  rawBody: string,
  deps: VerifySignatureDeps = {},
): Promise<boolean> {
  const fetchImpl = deps.fetchImpl ?? defaultFetch;
  const verify = deps.verify ?? verifyRsaSignature;
  const now = deps.now ?? (() => new Date());
  const maxAgeMs = deps.maxAgeMs ?? 5 * 60 * 1000;
  const cache = deps.certCache ?? new Map<string, string>();

  // 1. Transmission-time freshness.
  const sentAt = new Date(headers.transmissionTime);
  if (Number.isNaN(sentAt.getTime())) return false;
  if (Math.abs(now().getTime() - sentAt.getTime()) > maxAgeMs) return false;

  // 2. Fetch + cache the certificate.
  let certPem = cache.get(headers.certUrl);
  if (!certPem) {
    const res = await fetchImpl(headers.certUrl, { method: 'GET' });
    if (!res.ok) return false;
    certPem = await res.text();
    cache.set(headers.certUrl, certPem);
  }

  // 3. Build the transmission string and verify the signature.
  const transmissionString = `${headers.authAlgo}|${headers.transmissionId}|${headers.transmissionTime}|${config.webhookId}|${rawBody}`;
  return verify(certPem, headers.transmissionSig, transmissionString);
}

/**
 * Normalize a verified PayPal webhook event into canonical ledger shape.
 * Only PAYMENT.CAPTURE.COMPLETED is accepted.
 */
export function normalizePayPalWebhookEvent(payload: any): NormalizedPayment | null {
  if (payload?.event_type !== 'PAYMENT.CAPTURE.COMPLETED') return null;
  const resource = payload.resource ?? {};
  if (resource.status !== 'COMPLETED') return null;
  const invoiceId = resource.custom_id ? Number(resource.custom_id) : undefined;
  return {
    providerEventId: resource.id ?? payload.id,
    provider: 'paypal',
    providerReference: resource.id,
    amountCents: dollarsToCents(resource.amount?.value ?? '0'),
    currency: (resource.amount?.currency_code ?? 'USD').toUpperCase(),
    status: 'completed',
    paymentMethod: 'paypal',
    invoiceId: Number.isInteger(invoiceId) ? invoiceId : undefined,
  };
}

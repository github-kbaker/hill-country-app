import { describe, expect, test } from 'bun:test';
import { generateKeyPairSync, sign, createPrivateKey, createPublicKey } from 'node:crypto';
import {
  centsToDollars,
  dollarsToCents,
  addCents,
} from '../src/lib/payments/provider';
import {
  payPalBaseUrl,
  getPayPalAccessToken,
  createPayPalOrder,
  capturePayPalOrder,
  verifyPayPalWebhookSignature,
  verifyRsaSignature,
  normalizePayPalWebhookEvent,
} from '../src/lib/payments/paypal';
import { normalizeStripeEvent } from '../src/lib/payments/stripe';

const CONFIG = {
  clientId: 'sandbox_client_id',
  clientSecret: 'sandbox_client_secret',
  mode: 'sandbox' as const,
  webhookId: 'WH-12345',
};

/** Minimal fetch stub that records calls and returns scripted responses. */
function fetchStub(responses: Array<{ ok: boolean; status: number; body: any }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift()!;
    return { ok: r.ok, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) };
  };
  return { calls, impl };
}

describe('currency-safe conversion', () => {
  test('integer cents → 2-decimal USD strings and back', () => {
    expect(centsToDollars(27500)).toBe('275.00');
    expect(centsToDollars(99)).toBe('0.99');
    expect(centsToDollars(123456)).toBe('1234.56');
    expect(dollarsToCents('275.00')).toBe(27500);
    expect(dollarsToCents('0.99')).toBe(99);
    expect(dollarsToCents(1234.56)).toBe(123456);
  });

  test('addCents rejects non-integer and negative values', () => {
    expect(addCents(100, 200)).toBe(300);
    expect(() => addCents(100, 0.1)).toThrow();
    expect(() => addCents(-5)).toThrow();
  });
});

describe('PayPal sandbox provider', () => {
  test('base URL is sandbox by default; live only when configured', () => {
    expect(payPalBaseUrl('sandbox')).toBe('https://api-m.sandbox.paypal.com');
    expect(payPalBaseUrl('live')).toBe('https://api-m.paypal.com');
  });

  test('getPayPalAccessToken posts client_credentials with Basic auth', async () => {
    const { calls, impl } = fetchStub([{ ok: true, status: 200, body: { access_token: 'tok_1', token_type: 'Bearer' } }]);
    const token = await getPayPalAccessToken(CONFIG, impl as any);
    expect(token).toBe('tok_1');
    expect(calls[0].url).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token');
    expect(calls[0].init?.body).toBe('grant_type=client_credentials');
    expect(String((calls[0].init?.headers as any).Authorization)).toBe(`Basic ${Buffer.from('sandbox_client_id:sandbox_client_secret').toString('base64')}`);
  });

  test('auth failure throws with status', async () => {
    const { impl } = fetchStub([{ ok: false, status: 401, body: { error: 'invalid_client' } }]);
    await expect(getPayPalAccessToken(CONFIG, impl as any)).rejects.toThrow(/401/);
  });

  test('createPayPalOrder sends integer-cents amount as USD string + approve link', async () => {
    const { calls, impl } = fetchStub([
      { ok: true, status: 200, body: { access_token: 'tok_2' } },
      {
        ok: true, status: 201,
        body: { id: 'ORDER-1', status: 'CREATED', links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1' }] },
      },
    ]);
    const order = await createPayPalOrder(CONFIG, {
      amountCents: 27500,
      invoiceId: 7,
      invoiceNumber: 'HCSC-2026-000007',
      returnUrl: 'https://app.example.com/pay/success',
      cancelUrl: 'https://app.example.com/pay',
    }, impl as any);
    expect(order.id).toBe('ORDER-1');
    expect(order.approveUrl).toContain('sandbox.paypal.com');
    const orderCall = calls[1];
    const body = JSON.parse(String(orderCall.init?.body));
    expect(body.intent).toBe('CAPTURE');
    expect(body.purchase_units[0].amount.value).toBe('275.00');
    expect(body.purchase_units[0].custom_id).toBe('7');
    expect(body.purchase_units[0].invoice_id).toBe('HCSC-2026-000007');
  });

  test('capturePayPalOrder extracts capture + custom_id', async () => {
    const { impl } = fetchStub([
      { ok: true, status: 200, body: { access_token: 'tok_3' } },
      {
        ok: true, status: 201,
        body: {
          status: 'COMPLETED',
          purchase_units: [{ custom_id: '7', payments: { captures: [{ id: 'CAP-1', status: 'COMPLETED', amount: { currency_code: 'USD', value: '275.00' } }] } }],
        },
      },
    ]);
    const capture = await capturePayPalOrder(CONFIG, 'ORDER-1', impl as any);
    expect(capture.captureId).toBe('CAP-1');
    expect(capture.amountCents).toBe(27500);
    expect(capture.customId).toBe('7');
  });
});

describe('PayPal webhook signature verification', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const now = new Date('2026-08-08T12:00:00.000Z');

  function makeHeaders(overrides: Partial<Record<string, string>> = {}) {
    return {
      transmissionId: 'TX-001',
      transmissionTime: now.toISOString(),
      transmissionSig: 'sig',
      certUrl: 'https://paypal.example/cert.pem',
      authAlgo: 'SHA256withRSA',
      ...overrides,
    };
  }

  function signTransmission(body: string, webhookId = CONFIG.webhookId) {
    const headers = makeHeaders();
    const data = `${headers.authAlgo}|${headers.transmissionId}|${headers.transmissionTime}|${webhookId}|${body}`;
    return sign('RSA-SHA256', Buffer.from(data), createPrivateKey(privatePem)).toString('base64');
  }

  function certFetch(pem: string) {
    return async () => ({ ok: true, status: 200, body: pem, json: async () => ({}), text: async () => pem });
  }

  test('accepts a genuine signature (real RSA verification)', async () => {
    const rawBody = JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED' });
    const headers = makeHeaders({ transmissionSig: signTransmission(rawBody) });
    const ok = await verifyPayPalWebhookSignature(CONFIG, headers, rawBody, {
      fetchImpl: certFetch(publicPem) as any,
      now: () => now,
    });
    expect(ok).toBe(true);
  });

  test('rejects a tampered payload', async () => {
    const rawBody = JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED' });
    const headers = makeHeaders({ transmissionSig: signTransmission(rawBody) });
    const tampered = JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED', evil: true });
    const ok = await verifyPayPalWebhookSignature(CONFIG, headers, tampered, {
      fetchImpl: certFetch(publicPem) as any,
      now: () => now,
    });
    expect(ok).toBe(false);
  });

  test('rejects a stale transmission time (>5 min)', async () => {
    const rawBody = JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED' });
    const headers = makeHeaders({ transmissionSig: signTransmission(rawBody), transmissionTime: new Date(now.getTime() - 6 * 60 * 1000).toISOString() });
    const ok = await verifyPayPalWebhookSignature(CONFIG, headers, rawBody, {
      fetchImpl: certFetch(publicPem) as any,
      now: () => now,
    });
    expect(ok).toBe(false);
  });

  test('rejects a wrong webhook id (signature over different webhook)', async () => {
    const rawBody = JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED' });
    const headers = makeHeaders({ transmissionSig: signTransmission(rawBody) });
    const ok = await verifyPayPalWebhookSignature(CONFIG, headers, rawBody, {
      fetchImpl: certFetch(publicPem) as any,
      now: () => now,
    });
    // Signed for CONFIG.webhookId with the same value → true; then test a mismatch:
    const otherWebhook = await verifyPayPalWebhookSignature(
      { ...CONFIG, webhookId: 'WH-OTHER' }, headers, rawBody,
      { fetchImpl: certFetch(publicPem) as any, now: () => now },
    );
    expect(ok).toBe(true);
    expect(otherWebhook).toBe(false);
  });

  test('rejects when the certificate cannot be fetched', async () => {
    const rawBody = JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED' });
    const headers = makeHeaders({ transmissionSig: signTransmission(rawBody) });
    const ok = await verifyPayPalWebhookSignature(CONFIG, headers, rawBody, {
      fetchImpl: (async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" })) as any,
      now: () => now,
    });
    expect(ok).toBe(false);
  });

  test('verifyRsaSignature: wrong key and garbage are rejected', () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const otherPem = other.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const data = 'some-transmission';
    const sig = sign('RSA-SHA256', Buffer.from(data), createPrivateKey(privatePem)).toString('base64');
    expect(verifyRsaSignature(publicPem, sig, data)).toBe(true);
    expect(verifyRsaSignature(otherPem, sig, data)).toBe(false);
    expect(verifyRsaSignature(publicPem, 'AAAA', data)).toBe(false);
    expect(verifyRsaSignature('not a pem', sig, data)).toBe(false);
  });
});

describe('webhook event normalization', () => {
  test('PayPal PAYMENT.CAPTURE.COMPLETED normalizes with custom_id as invoiceId', () => {
    const normalized = normalizePayPalWebhookEvent({
      id: 'EVENT-1',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: 'CAP-9', status: 'COMPLETED', custom_id: '7', amount: { currency_code: 'USD', value: '275.00' } },
    });
    expect(normalized).not.toBeNull();
    expect(normalized!.provider).toBe('paypal');
    expect(normalized!.providerEventId).toBe('CAP-9');
    expect(normalized!.invoiceId).toBe(7);
    expect(normalized!.amountCents).toBe(27500);
  });

  test('unhandled PayPal event types and non-completed captures are ignored', () => {
    expect(normalizePayPalWebhookEvent({ id: 'E2', event_type: 'CHECKOUT.ORDER.APPROVED', resource: {} })).toBeNull();
    expect(normalizePayPalWebhookEvent({ id: 'E3', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'C1', status: 'DECLINED', custom_id: '1' } })).toBeNull();
  });

  test('Stripe checkout.session.completed normalizes with metadata', () => {
    const normalized = normalizeStripeEvent({
      id: 'evt_0001',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_1', amount_total: 27500, currency: 'usd', customer_details: { email: 'mbaker789@gmail.com', name: 'Michonne' }, metadata: { invoiceId: '7', invoiceNumber: 'HCSC-2026-000007' } } },
    } as any);
    expect(normalized).not.toBeNull();
    expect(normalized!.provider).toBe('stripe');
    expect(normalized!.providerEventId).toBe('evt_0001');
    expect(normalized!.invoiceId).toBe(7);
    expect(normalized!.amountCents).toBe(27500);
    expect(normalized!.customerEmail).toBe('mbaker789@gmail.com');
  });

  test('Stripe unhandled events are ignored', () => {
    expect(normalizeStripeEvent({ id: 'evt_2', type: 'invoice.created', data: { object: {} } } as any)).toBeNull();
  });
});

/**
 * Stripe provider (TEST MODE by default — never point STRIPE_SECRET_KEY at a
 * live key in this environment). Wraps the Stripe SDK and normalizes events.
 *
 * Idempotency: every event the service consumes is keyed by
 * `event.id` (providerEventId) with a UNIQUE constraint in the ledger, so
 * Stripe webhook redeliveries can never double-apply a payment.
 */

import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import type { NormalizedPayment } from '@/lib/payments/provider';

export interface StripeCheckoutParams {
  amountCents: number;
  invoiceId: number;
  invoiceNumber: string;
  customerEmail?: string;
  customerName?: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createStripeCheckoutSession(params: StripeCheckoutParams): Promise<{ sessionId: string; url: string }> {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: `Appliance Repair — Invoice #${params.invoiceNumber}` },
          unit_amount: params.amountCents,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email: params.customerEmail,
    client_reference_id: String(params.invoiceId),
    metadata: {
      invoiceId: String(params.invoiceId),
      invoiceNumber: params.invoiceNumber,
    },
  });
  return { sessionId: session.id, url: session.url ?? '' };
}

/**
 * Normalize a verified Stripe event into the canonical ledger shape.
 * Signature verification happens in the route via stripe.webhooks.constructEvent
 * (existing pattern); this function never trusts unverified input.
 */
export function normalizeStripeEvent(event: Stripe.Event): NormalizedPayment | null {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!session.amount_total) return null;
      return {
        providerEventId: event.id,
        provider: 'stripe',
        providerReference: session.id,
        amountCents: session.amount_total,
        currency: (session.currency || 'usd').toUpperCase(),
        status: 'completed',
        customerEmail: session.customer_details?.email ?? undefined,
        customerName: session.customer_details?.name ?? undefined,
        paymentMethod: 'card',
        invoiceId: session.metadata?.invoiceId ? Number(session.metadata.invoiceId) : undefined,
        invoiceNumber: session.metadata?.invoiceNumber,
      };
    }
    default:
      return null;
  }
}

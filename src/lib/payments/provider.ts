/**
 * Canonical payment provider abstraction for the invoice ledger.
 *
 * All monetary values across this ledger are INTEGER CENTS — never floats.
 * Provider APIs are normalized to this unit at the boundary.
 *
 * Implementations: stripe (test mode), paypal (sandbox), manual.
 */

export type PaymentProviderName = 'stripe' | 'paypal' | 'manual';

export interface NormalizedPayment {
  /** Provider event/payment id — used as the idempotency key (UNIQUE). */
  providerEventId: string;
  provider: PaymentProviderName;
  /** Secondary provider reference (e.g. Stripe session id, PayPal order id). */
  providerReference?: string;
  amountCents: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed';
  /** Plain metadata useful for ledger/receipt records. */
  customerEmail?: string;
  customerName?: string;
  paymentMethod?: string;
  invoiceId?: number;
  invoiceNumber?: string;
}

/** Normalize raw dollar string from PayPal to integer cents (round-half-up). */
export function dollarsToCents(dollars: string | number): number {
  return Math.round(Number(dollars) * 100);
}

/** Format integer cents as a 2-decimal USD string for provider APIs ("275.00"). */
export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents);
}

/** Currency-safe addition; rejects non-integer cents to prevent float drift. */
export function addCents(...amounts: number[]): number {
  for (const a of amounts) {
    if (!Number.isInteger(a)) throw new Error(`Non-integer cents value: ${a}`);
    if (a < 0) throw new Error(`Negative cents value: ${a}`);
  }
  return amounts.reduce((sum, a) => sum + a, 0);
}

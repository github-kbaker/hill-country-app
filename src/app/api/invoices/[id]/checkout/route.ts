import { NextResponse } from 'next/server';
import { InvoiceService } from '@/lib/invoice';
import { query } from '@/lib/db';
import { createStripeCheckoutSession } from '@/lib/payments/stripe';

export const runtime = 'nodejs';

/** POST /api/invoices/[id]/checkout — create a Stripe Checkout session (test mode). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const service = new InvoiceService({ db: { query } });
    let invoice;
    try {
      invoice = service.get(Number(id));
    } catch {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    if (invoice.status === 'cancelled') return NextResponse.json({ error: 'Invoice cancelled' }, { status: 409 });
    if (invoice.balance_cents <= 0) return NextResponse.json({ error: 'Invoice is already paid' }, { status: 409 });

    const body = (await req.json().catch(() => ({}))) as { amountCents?: number };
    const amountCents = body.amountCents && body.amountCents > 0 ? Math.min(body.amountCents, invoice.balance_cents) : invoice.balance_cents;

    const base = process.env.NEXT_PUBLIC_BASE_URL || '';
    const { sessionId, url } = await createStripeCheckoutSession({
      amountCents,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      customerEmail: invoice.customer_email ?? undefined,
      customerName: invoice.customer_name ?? undefined,
      successUrl: `${base}/pay/success?session_id={CHECKOUT_SESSION_ID}&invoice=${invoice.invoice_number}`,
      cancelUrl: `${base}/pay?invoice=${invoice.invoice_number}`,
    });
    return NextResponse.json({ sessionId, url, amountCents, invoiceNumber: invoice.invoice_number });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

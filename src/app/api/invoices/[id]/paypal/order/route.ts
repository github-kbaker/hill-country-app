import { NextResponse } from 'next/server';
import { InvoiceService } from '@/lib/invoice';
import { query } from '@/lib/db';
import { createPayPalOrder, getPayPalConfig } from '@/lib/payments/paypal';

export const runtime = 'nodejs';

/** POST /api/invoices/[id]/paypal/order — create a PayPal sandbox order. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const config = getPayPalConfig();
    if (!config) {
      return NextResponse.json({ error: 'PayPal is not configured (set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID)' }, { status: 503 });
    }
    const { id } = await params;
    const service = new InvoiceService({ db: { query } });
    let invoice;
    try {
      invoice = await service.get(Number(id));
    } catch {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    if (invoice.status === 'cancelled') return NextResponse.json({ error: 'Invoice cancelled' }, { status: 409 });
    if (invoice.balance_cents <= 0) return NextResponse.json({ error: 'Invoice is already paid' }, { status: 409 });

    const body = (await req.json().catch(() => ({}))) as { amountCents?: number; returnUrl?: string; cancelUrl?: string };
    const amountCents = body.amountCents && body.amountCents > 0 ? Math.min(body.amountCents, invoice.balance_cents) : invoice.balance_cents;
    const base = process.env.NEXT_PUBLIC_BASE_URL || '';

    const order = await createPayPalOrder(config, {
      amountCents,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      returnUrl: body.returnUrl || `${base}/pay/success?provider=paypal&invoice=${invoice.invoice_number}`,
      cancelUrl: body.cancelUrl || `${base}/pay?invoice=${invoice.invoice_number}`,
    });
    return NextResponse.json({ orderId: order.id, approveUrl: order.approveUrl, status: order.status, amountCents, invoiceNumber: invoice.invoice_number });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

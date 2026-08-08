import { NextResponse } from 'next/server';
import { InvoiceService } from '@/lib/invoice';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/invoices/lookup?invoiceNumber=HCSC-YYYY-NNNNNN
 * Public-safe lookup for the pay page: returns only display fields and the
 * canonical balance. Never leaks customer email, notes, or events.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const invoiceNumber = (url.searchParams.get('invoiceNumber') ?? '').trim().toUpperCase();
  if (!/^HCSC-\d{4}-\d{6}$/.test(invoiceNumber)) {
    return NextResponse.json({ error: 'Invalid invoice number format' }, { status: 400 });
  }
  try {
    const service = new InvoiceService({ db: { query } });
    const invoice = service.findPublicByNumber(invoiceNumber);
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    return NextResponse.json({
      invoiceNumber: invoice.invoice_number,
      status: invoice.status,
      totalCents: invoice.total_cents,
      paidCents: invoice.paid_cents,
      balanceCents: invoice.balance_cents,
      currency: invoice.currency,
      dueDate: invoice.due_date,
      paymentMethods: (invoice.payment_methods ?? '').split(',').filter(Boolean),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

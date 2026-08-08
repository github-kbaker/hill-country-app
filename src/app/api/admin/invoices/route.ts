import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminRequest, unauthorizedResponse } from '@/lib/admin-auth';
import { InvoiceService } from '@/lib/invoice';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

const createSchema = z.object({
  action: z.literal('create'),
  requestId: z.number().int().positive().nullable().optional(),
  subtotalCents: z.number().int().min(1),
  discountCents: z.number().int().min(0).optional(),
  taxCents: z.number().int().min(0).optional(),
  discountReason: z.string().max(500).optional(),
  dueDate: z.string().max(20).optional(),
  paymentMethods: z.string().max(200).optional(),
  customerName: z.string().max(200).optional(),
  customerEmail: z.string().email().optional().or(z.literal('')).optional(),
});

const sendSchema = z.object({ action: z.literal('send'), invoiceId: z.number().int().positive() });

const addPaymentSchema = z.object({
  action: z.literal('add-payment'),
  invoiceId: z.number().int().positive(),
  amountCents: z.number().int().min(1),
  method: z.string().min(2).max(40),
  reference: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
  idempotencyKey: z.string().max(200).optional(),
});

const releasePayoutSchema = z.object({ action: z.literal('release-payout'), invoiceId: z.number().int().positive(), force: z.boolean().optional() });

export async function GET(req: Request) {
  if (!isAdminRequest(req)) return unauthorizedResponse();
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const service = new InvoiceService({ db: { query } });
    if (id) {
      return NextResponse.json({ invoice: await service.get(Number(id)) });
    }
    const invoices = await Promise.all((await service.list()).map((i) => service.get(i.id)));
    const summary = {
      total: invoices.length,
      final_sent: invoices.filter((i) => i.status === 'final_invoice_sent').length,
      paid: invoices.filter((i) => i.status === 'invoice_paid').length,
      draft: invoices.filter((i) => i.status === 'draft').length,
      outstanding_cents: invoices.reduce((s, i) => s + (i.status === 'invoice_paid' ? 0 : i.balance_cents), 0),
    };
    return NextResponse.json({ invoices, summary });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isAdminRequest(req)) return unauthorizedResponse();
  const service = new InvoiceService({ db: { query } });
  try {
    const body = await req.json();

    if (body?.action === 'create') {
      const parsed = createSchema.parse(body);
      const invoice = await service.create({
        requestId: parsed.requestId ?? null,
        subtotalCents: parsed.subtotalCents,
        discountCents: parsed.discountCents ?? 0,
        taxCents: parsed.taxCents ?? 0,
        discountReason: parsed.discountReason,
        dueDate: parsed.dueDate,
        paymentMethods: parsed.paymentMethods,
        customerName: parsed.customerName,
        customerEmail: parsed.customerEmail || undefined,
      });
      return NextResponse.json({ invoice }, { status: 201 });
    }

    if (body?.action === 'send') {
      const parsed = sendSchema.parse(body);
      const result = await service.send(parsed.invoiceId);
      return NextResponse.json(result);
    }

    if (body?.action === 'add-payment') {
      const parsed = addPaymentSchema.parse(body);
      const result = await service.recordManualPayment({
        invoiceId: parsed.invoiceId,
        amountCents: parsed.amountCents,
        method: parsed.method,
        reference: parsed.reference,
        note: parsed.note,
        idempotencyKey: parsed.idempotencyKey,
      });
      return NextResponse.json(result);
    }

    if (body?.action === 'release-payout') {
      const parsed = releasePayoutSchema.parse(body);
      const invoice = await service.releasePayout(parsed.invoiceId, { force: parsed.force });
      return NextResponse.json({ invoice });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    const status = error?.issues ? 400 : 500;
    return NextResponse.json({ error: error?.issues ? error.issues : error.message }, { status });
  }
}

import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { headers } from 'next/headers';
import { query, escape } from '@/lib/db';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('Stripe-Signature') as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: 'Webhook Error' }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as any;
      console.log(`Payment successful for Invoice: ${session.metadata.invoiceNumber}`);
      
      try {
        query(`INSERT INTO app_payments (invoice_number, customer_name, customer_email, amount, currency, stripe_session_id, status) VALUES (${escape(session.metadata.invoiceNumber)}, ${escape(session.customer_details?.name)}, ${escape(session.customer_details?.email)}, ${session.amount_total}, ${escape(session.currency)}, ${escape(session.id)}, 'paid')`);
      } catch (dbError) {
        console.error('Failed to persist payment:', dbError);
      }
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey && process.env.NODE_ENV === 'production') {
  console.warn('STRIPE_SECRET_KEY is not defined. Stripe functionality will be disabled.');
}

export const stripe = new Stripe(stripeSecretKey || 'dummy_key');

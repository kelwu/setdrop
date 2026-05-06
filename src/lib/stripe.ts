import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-04-22.dahlia',
});

export const PLANS = {
  pro: {
    name: 'SetDrop Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? '',
    limit: 50,
  },
  free: {
    name: 'SetDrop Free',
    limit: 5,
  },
} as const;

import Stripe from 'stripe';
import { BRAND } from './brand';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-04-22.dahlia',
    });
  }
  return _stripe;
}

export const PLANS = {
  pro: {
    name: `${BRAND.name} Pro`,
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? '',
    setLimit: 50,
    crateLimit: 30,
    trackIdLimit: 500,
  },
  free: {
    name: `${BRAND.name} Free`,
    setLimit: 5,
    crateLimit: 3,
    trackIdLimit: 10,
  },
} as const;

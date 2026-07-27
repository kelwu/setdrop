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

// Generation (sets + crates) is unlimited for normal use; `dailyGenCap` is only a
// soft anti-abuse ceiling (null = no cap). The paywall is `exportLimit`: the number
// of DISTINCT sets/crates a user can export per calendar month (null = unlimited).
// Track ID is a separate bonus with its own monthly limit.
export const PLANS = {
  pro: {
    name: `${BRAND.name} Pro`,
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? '',
    exportLimit: null as number | null,
    dailyGenCap: null as number | null,
    trackIdLimit: 500,
  },
  free: {
    name: `${BRAND.name} Free`,
    exportLimit: 3 as number | null,
    dailyGenCap: 25 as number | null,
    trackIdLimit: 10,
  },
} as const;

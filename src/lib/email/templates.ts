// Transactional emails only — sent directly via Resend in response to explicit user actions.
// Marketing / nurturing emails are handled by Loops (src/lib/email/loops.ts).
//
// Currently used by:
//   - /api/setlist/notify  → "your set is ready"
//   - /api/invoice/send    → invoice PDF delivery
//
// These do NOT require unsubscribe links because they are triggered by the user's own action.

import { Resend } from 'resend';
import { BRAND } from '@/lib/brand';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setlab.ai';

export function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

export function emailFrom(): string {
  const addr = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
  return `${BRAND.name} <${addr}>`;
}

export { APP_URL };

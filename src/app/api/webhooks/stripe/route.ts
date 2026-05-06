import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import type Stripe from 'stripe';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown';
    console.error('[stripe-webhook] Signature verification failed:', message);
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  const supabase = await createClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      const subscriptionId = session.subscription as string | null;
      if (userId && subscriptionId) {
        await supabase.from('users').update({
          subscription_tier: 'pro',
          stripe_subscription_id: subscriptionId,
        }).eq('id', userId);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      // Find user by Stripe customer ID
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();
      if (userRow) {
        await supabase.from('users').update({
          subscription_tier: 'free',
          stripe_subscription_id: null,
        }).eq('id', userRow.id);
      }
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const isActive = subscription.status === 'active' || subscription.status === 'trialing';
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();
      if (userRow) {
        await supabase.from('users').update({
          subscription_tier: isActive ? 'pro' : 'free',
        }).eq('id', userRow.id);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

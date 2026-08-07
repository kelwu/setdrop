import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Account } from '@/components/setdrop/Account';
import { PLANS } from '@/lib/stripe';

// Per-user authed page — never prerender it. (Also prevents a missing/rotated
// Supabase env var from failing the whole production build at prerender time.)
export const dynamic = 'force-dynamic';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [userRowRes, exportRowsRes, params] = await Promise.all([
    supabase.from('users').select('subscription_tier, stripe_customer_id').eq('id', user.id).single(),
    supabase.from('exports')
      .select('source_type, source_id')
      .eq('user_id', user.id)
      .gte('created_at', monthStart),
    searchParams,
  ]);

  const tier = (userRowRes.data?.subscription_tier ?? 'free') as 'free' | 'pro';
  // Count distinct sets/crates exported this month — matches the export-gate rule.
  const distinct = new Set(
    (exportRowsRes.data ?? []).map(r => `${r.source_type}:${r.source_id}`),
  );
  const limit = PLANS[tier].exportLimit ?? 0; // 0 for Pro (unlimited; bar hidden)

  return (
    <Account
      email={user.email ?? ''}
      tier={tier}
      exportsUsed={distinct.size}
      limit={limit}
      hasStripeCustomer={!!userRowRes.data?.stripe_customer_id}
      upgraded={params.upgraded === '1'}
    />
  );
}

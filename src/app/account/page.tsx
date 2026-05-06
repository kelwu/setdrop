import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Account } from '@/components/setdrop/Account';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [userRowRes, countRes, params] = await Promise.all([
    supabase.from('users').select('subscription_tier, stripe_customer_id').eq('id', user.id).single(),
    supabase.from('setlists')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 3_600_000).toISOString()),
    searchParams,
  ]);

  const tier = userRowRes.data?.subscription_tier ?? 'free';
  const limit = tier === 'pro' ? 50 : 5;

  return (
    <Account
      email={user.email ?? ''}
      tier={tier}
      setsUsed={countRes.count ?? 0}
      limit={limit}
      hasStripeCustomer={!!userRowRes.data?.stripe_customer_id}
      upgraded={params.upgraded === '1'}
    />
  );
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SetlistHistory } from '@/components/setdrop/SetlistHistory';

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <SetlistHistory />;
}

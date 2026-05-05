import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SetlistBuilder } from '@/components/setdrop/SetlistBuilder';

export default async function BuilderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <SetlistBuilder />;
}

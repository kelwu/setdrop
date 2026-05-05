import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SetlistOutput } from '@/components/setdrop/SetlistOutput';

export default async function OutputPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <SetlistOutput />;
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Library } from '@/components/setdrop/Library';

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <Library />;
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/setdrop/shared';
import { CrateBuilder } from '@/components/setdrop/CrateBuilder';

export default async function CratesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return (
    <>
      <Nav />
      <main style={{ paddingTop: 56 }}>
        <CrateBuilder />
      </main>
    </>
  );
}

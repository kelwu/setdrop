import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, link_url, link_label, created_at')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ announcements: [] });
  return NextResponse.json({ announcements: data ?? [] });
}

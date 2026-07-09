import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();
  const { data } = await db
    .from('announcements')
    .select('id, title, body, link_url, link_label, active, created_at')
    .order('created_at', { ascending: false });

  return NextResponse.json({ announcements: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, body, link_url, link_label } = await req.json() as {
    title?: string; body?: string; link_url?: string; link_label?: string;
  };
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from('announcements')
    .insert({ title: title.trim(), body: body?.trim() || null, link_url: link_url?.trim() || null, link_label: link_label?.trim() || null })
    .select('id, title, body, link_url, link_label, active, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcement: data });
}

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';
import { BRAND } from '@/lib/brand';

export async function POST(req: NextRequest) {
  const { message, page } = await req.json();

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error: dbError } = await supabase.from('feedback').insert({
    user_id: user?.id ?? null,
    email: user?.email ?? null,
    message: message.trim(),
    page: page ?? null,
  });

  if (dbError) {
    console.error('[feedback] db insert failed', dbError.message);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';

  if (apiKey) {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `${BRAND.name} Feedback <${fromEmail}>`,
      to: 'kelcwu@gmail.com',
      subject: `New feedback${user?.email ? ` from ${user.email}` : ''}`,
      html: `
        <div style="font-family:monospace;max-width:600px">
          <h2 style="color:#F5A623;margin:0 0 16px">${BRAND.name} — New Feedback</h2>
          <p style="white-space:pre-wrap;background:#141414;color:#F0F0F0;padding:16px;border-radius:4px;border:1px solid #222">${message.trim()}</p>
          <table style="color:#909090;font-size:12px;margin-top:16px;border-collapse:collapse">
            <tr><td style="padding:2px 12px 2px 0">From</td><td>${user?.email ?? 'anonymous'}</td></tr>
            <tr><td style="padding:2px 12px 2px 0">Page</td><td>${page ?? '—'}</td></tr>
          </table>
        </div>
      `,
    }).catch(err => console.error('[feedback] email failed', err));
  }

  return NextResponse.json({ success: true });
}

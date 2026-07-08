import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';
import { SYSTEM_PROMPT, isMessageBlocked } from '@/lib/setdrop/knowledge';
import { createClient } from '@/lib/supabase/server';
import { BRAND } from '@/lib/brand';

export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { message, page } = await req.json();

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 });
  }
  if (message.length > 1000) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 });
  }

  // Server-side guardrail — catch anything that slipped past the client
  if (isMessageBlocked(message)) {
    return NextResponse.json({ blocked: true });
  }

  // Log to feedback table and notify via email (non-blocking)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  supabase.from('feedback').insert({
    user_id: user?.id ?? null,
    email: user?.email ?? null,
    message: `[chat] ${message.trim()}`,
    page: page ?? null,
  }).then(() => {});

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
  if (apiKey) {
    const resend = new Resend(apiKey);
    resend.emails.send({
      from: `${BRAND.name} Chat <${fromEmail}>`,
      to: 'kelcwu@gmail.com',
      subject: `Chat question${user?.email ? ` from ${user.email}` : ' from visitor'}`,
      html: `
        <div style="font-family:monospace;max-width:600px">
          <h2 style="color:#F5A623;margin:0 0 16px">${BRAND.name} — Chat Question</h2>
          <p style="white-space:pre-wrap;background:#141414;color:#F0F0F0;padding:16px;border-radius:4px;border:1px solid #222">${message.trim()}</p>
          <table style="color:#909090;font-size:12px;margin-top:16px;border-collapse:collapse">
            <tr><td style="padding:2px 12px 2px 0">From</td><td>${user?.email ?? 'anonymous visitor'}</td></tr>
            <tr><td style="padding:2px 12px 2px 0">Page</td><td>${page ?? '—'}</td></tr>
          </table>
        </div>
      `,
    }).catch(err => console.error('[chat] email failed', err));
  }

  const stream = await anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: message.trim() }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

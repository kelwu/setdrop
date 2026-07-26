import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { SYSTEM_PROMPT, isMessageBlocked } from '@/lib/setdrop/knowledge';
import { createClient } from '@/lib/supabase/server';
import { getAnthropic } from '@/lib/anthropic';
import { BRAND } from '@/lib/brand';

export const maxDuration = 30;

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
      replyTo: user?.email ?? undefined,
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

  // Open the stream before returning so a pre-stream failure surfaces as a real
  // HTTP error rather than an empty 200. The timeout guards against a hung call
  // silently eating the 30s function budget.
  let stream: ReturnType<ReturnType<typeof getAnthropic>['messages']['stream']>;
  try {
    stream = getAnthropic().messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message.trim() }],
    }, { timeout: 25_000 });
  } catch (err) {
    console.error('[chat] stream failed to start', err);
    return new Response('Sorry — chat is unavailable right now. Please try again.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

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
      } catch (err) {
        // Mid-stream failure (timeout, aborted connection, etc.). The client has
        // already received a 200 + partial text, so append a visible notice
        // instead of closing silently on a truncated reply.
        console.error('[chat] stream interrupted', err);
        controller.enqueue(encoder.encode('\n\n_(Got cut off — please try again.)_'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

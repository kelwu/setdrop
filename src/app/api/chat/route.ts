import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, isMessageBlocked } from '@/lib/setdrop/knowledge';
import { createClient } from '@/lib/supabase/server';

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

  // Log to feedback table (non-blocking) so you can review what users ask
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  supabase.from('feedback').insert({
    user_id: user?.id ?? null,
    email: user?.email ?? null,
    message: `[chat] ${message.trim()}`,
    page: page ?? null,
  }).then(() => {});

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

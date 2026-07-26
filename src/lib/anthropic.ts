import Anthropic from '@anthropic-ai/sdk';

// Single shared Anthropic client. The SDK's default per-request timeout is 10
// minutes — longer than any of our route maxDurations — so without an explicit
// timeout a stalled model call silently blows the function budget instead of
// failing cleanly (the bug we hit on /api/generate-setlist).
//
// The `timeout` here is a backstop; callers should still pass a per-call
// { timeout } sized to their route's maxDuration (the per-call option overrides
// this default). `maxRetries: 1` bounds retry latency so a stall can't stack
// multiple attempts past the budget.
let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 60_000,
      maxRetries: 1,
    });
  }
  return _client;
}

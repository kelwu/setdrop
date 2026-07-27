import { initBotId } from 'botid/client/core';
import * as Sentry from '@sentry/nextjs';

// Attach BotID challenges to the expensive, cost-incurring endpoints so scripted
// abuse of unlimited generation is blocked before it burns API spend. Server-side
// checkBotId() runs in each of these route handlers.
initBotId({
  protect: [
    { path: '/api/generate-setlist', method: 'POST' },
    { path: '/api/crates/generate', method: 'POST' },
    { path: '/api/track-id', method: 'POST' },
  ],
});

// Sentry requires this hook to be exported from instrumentation-client to
// instrument client-side navigations (Sentry.init still runs in
// sentry.client.config.ts).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = Sentry_onRequestError;

async function Sentry_onRequestError(...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>) {
  const { captureRequestError } = await import('@sentry/nextjs');
  captureRequestError(...args);
}

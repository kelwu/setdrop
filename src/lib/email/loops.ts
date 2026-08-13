const LOOPS_API = 'https://app.loops.so/api/v1';

function headers() {
  return {
    Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export async function loopsCreateContact(email: string) {
  if (!process.env.LOOPS_API_KEY) return;
  await fetch(`${LOOPS_API}/contacts/create`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, source: 'setlab-signup' }),
  }).catch(() => {});
}

export async function loopsSendEvent(
  email: string,
  eventName: string,
  data?: Record<string, string | number>,
) {
  if (!process.env.LOOPS_API_KEY) return;
  await fetch(`${LOOPS_API}/events/send`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, eventName, ...data }),
  }).catch(() => {});
}

// Upsert contact properties in Loops (subscriptionTier, libraryImported,
// setlistsGenerated, signedUpAt, …). These feed segmentation for lifecycle /
// conversion campaigns — they do NOT send anything themselves. Always call
// fire-and-forget (no await) so it can never block the user response.
export async function updateLoopsContact(
  email: string,
  properties: Record<string, string | number | boolean>,
): Promise<void> {
  if (!process.env.LOOPS_API_KEY) return;
  try {
    await fetch(`${LOOPS_API}/contacts/update`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ email, ...properties }),
    });
  } catch {
    console.error('[Loops] contact update failed silently');
  }
}

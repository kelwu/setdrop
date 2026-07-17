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

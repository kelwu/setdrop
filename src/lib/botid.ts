import { checkBotId } from 'botid/server';

// Returns true only for a verified bot. Fails OPEN (returns false) on any error
// so BotID can never take down a legitimate request path — it's an anti-abuse
// guard on the expensive endpoints, not a hard dependency. Local dev always
// returns false. The matching client paths live in src/instrumentation-client.ts.
export async function isBotRequest(): Promise<boolean> {
  try {
    const { isBot } = await checkBotId();
    return isBot === true;
  } catch {
    return false;
  }
}

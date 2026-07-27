import { trackEvent } from '@/lib/analytics';

export interface ExportGateResult {
  ok: boolean;
  /** Upgrade message to surface when blocked. Contains "Upgrade" so existing
   *  error banners render their Go-Pro affordance. */
  message?: string;
}

/**
 * Checks the monthly export limit before an export download and records the
 * export. Counts distinct sets/crates per month, so re-exporting the same item
 * or grabbing another format is free.
 *
 * Soft gate: fails open on anything other than an explicit 429, so a logging
 * hiccup never blocks a download.
 */
export async function gateExport(
  source: 'setlist' | 'crate',
  sourceId: string,
  format: string,
): Promise<ExportGateResult> {
  trackEvent.exportStarted(source, format);
  try {
    const res = await fetch('/api/exports/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceType: source, sourceId, format }),
    });
    if (res.status === 429) {
      const j = await res.json() as { limit?: number; resetsAt?: string };
      trackEvent.exportBlocked(source);
      const resets = j.resetsAt
        ? new Date(j.resetsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : 'next month';
      return {
        ok: false,
        message: `You've used all ${j.limit ?? 3} free exports this month. Upgrade to Pro for unlimited exports — resets ${resets}.`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/server';
import { BRAND } from '@/lib/brand';

export const maxDuration = 60;

// ── Thresholds ──────────────────────────────────────────────────────────────
const WINDOW_2H = 2 * 3_600_000;
const WINDOW_24H = 24 * 3_600_000;
const MIN_ATTEMPTS_2H = 3;        // need some traffic before a rate is meaningful
const FAIL_RATE_ALERT = 0.4;      // alert if <40% of recent attempts succeed
const LATENCY_WARN_MS = 200_000;  // p90 over this = creeping toward the ~285s ceiling
const MIN_SUCCESS_FOR_P90 = 5;
const REALERT_MS = 6 * 3_600_000; // re-remind at most every 6h during an ongoing incident
const ALERT_TO = 'kelcwu@gmail.com';

interface Check { key: string; breached: boolean; severity: 'CRITICAL' | 'WARN'; message: string; }
interface Note { kind: 'alert' | 'recovery'; check: Check; }

function p90(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))];
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const since2h = new Date(now - WINDOW_2H).toISOString();
  const since24h = new Date(now - WINDOW_24H).toISOString();

  // Setlist: attempts (api_usage) + outcome events (generation_events).
  const [{ count: setlistAttempts2h }, { data: events }, { count: crateAttempts24h }, { count: crateCompletions24h }] =
    await Promise.all([
      admin.from('api_usage').select('id', { count: 'exact', head: true })
        .eq('endpoint', 'generate-setlist').gte('created_at', since2h),
      admin.from('generation_events').select('status, duration_ms, created_at')
        .eq('endpoint', 'generate-setlist').gte('created_at', since24h).limit(3000),
      admin.from('api_usage').select('id', { count: 'exact', head: true })
        .eq('endpoint', 'crates-generate').gte('created_at', since24h),
      admin.from('usage_costs').select('id', { count: 'exact', head: true })
        .eq('endpoint', 'crates-generate').gte('created_at', since24h),
    ]);

  const evts = (events ?? []) as Array<{ status: string; duration_ms: number | null; created_at: string }>;
  const recent2h = evts.filter(e => e.created_at >= since2h);
  const success2h = recent2h.filter(e => e.status === 'success').length;
  const error2h = recent2h.filter(e => e.status === 'error').length;
  const rejected2h = recent2h.filter(e => e.status === 'rejected').length;
  const attempts2h = setlistAttempts2h ?? 0;
  // "Decided" = attempts that reached a real verdict (success or hard error).
  // Exclude user-input rejections (library too thin for the request) — a DJ
  // hammering an unsatisfiable filter is a working guardrail, not an outage.
  // Attempts logged with no terminal event (silent hangs/kills) still count
  // against the rate via the api_usage denominator; we fall back to the event
  // ledger when api_usage under-counts so the denominator is never too small.
  const decided2h = Math.max(attempts2h - rejected2h, success2h + error2h);
  const rate2h = decided2h > 0 ? success2h / decided2h : 1;

  const successDurations = evts
    .filter(e => e.status === 'success' && typeof e.duration_ms === 'number')
    .map(e => e.duration_ms as number);
  const p90ms = p90(successDurations);

  const cAttempts = crateAttempts24h ?? 0;
  const cCompletions = crateCompletions24h ?? 0;

  const checks: Check[] = [
    {
      key: 'gen_setlist_failrate',
      breached: decided2h >= MIN_ATTEMPTS_2H && rate2h < FAIL_RATE_ALERT,
      severity: success2h === 0 ? 'CRITICAL' : 'WARN',
      message: `Setlist generation: ${success2h}/${decided2h} succeeded in the last 2h (${Math.round(rate2h * 100)}%)${rejected2h ? `; ${rejected2h} rejected for insufficient library (excluded)` : ''}.`,
    },
    {
      key: 'gen_setlist_latency',
      breached: successDurations.length >= MIN_SUCCESS_FOR_P90 && p90ms > LATENCY_WARN_MS,
      severity: 'WARN',
      message: `Setlist p90 latency is ${Math.round(p90ms / 1000)}s over the last 24h (${successDurations.length} runs). The pipeline hard-fails at ~285s — it's drifting toward the ceiling.`,
    },
    {
      key: 'crate_down',
      breached: cAttempts >= MIN_ATTEMPTS_2H && cCompletions === 0,
      severity: 'CRITICAL',
      message: `Crate generation: 0/${cAttempts} completed in the last 24h.`,
    },
  ];

  // Reconcile against stored alert state → fire once per incident + on recovery.
  const { data: stateRows } = await admin.from('alert_state').select('alert_key, active, last_alerted_at');
  const stateMap = new Map((stateRows ?? []).map((r: { alert_key: string; active: boolean; last_alerted_at: string | null }) => [r.alert_key, r]));

  const notes: Note[] = [];
  for (const c of checks) {
    const prev = stateMap.get(c.key);
    if (c.breached) {
      const lastMs = prev?.last_alerted_at ? new Date(prev.last_alerted_at).getTime() : 0;
      const shouldSend = !prev?.active || now - lastMs > REALERT_MS;
      if (shouldSend) {
        notes.push({ kind: 'alert', check: c });
        await admin.from('alert_state').upsert({
          alert_key: c.key, active: true, last_alerted_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString(),
        });
      }
    } else if (prev?.active) {
      notes.push({ kind: 'recovery', check: c });
      await admin.from('alert_state').upsert({
        alert_key: c.key, active: false, updated_at: new Date(now).toISOString(),
      });
    }
  }

  if (notes.length) await sendAlertEmail(notes);

  return NextResponse.json({
    ok: true,
    setlist: { attempts2h, success2h, error2h, rejected2h, decided2h, rate2h: Number(rate2h.toFixed(2)), p90ms, runs24h: successDurations.length },
    crate: { attempts24h: cAttempts, completions24h: cCompletions },
    notified: notes.map(n => `${n.kind}:${n.check.key}`),
  });
}

async function sendAlertEmail(notes: Note[]) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.error('[health-check] RESEND_API_KEY missing — cannot send alert', notes); return; }
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
  const alerts = notes.filter(n => n.kind === 'alert');
  const recoveries = notes.filter(n => n.kind === 'recovery');
  const worst = alerts.some(a => a.check.severity === 'CRITICAL') ? '🔴' : alerts.length ? '🟠' : '🟢';
  const subject = alerts.length
    ? `${worst} ${BRAND.name} health: ${alerts.map(a => a.check.key).join(', ')}`
    : `🟢 ${BRAND.name} health: recovered (${recoveries.map(r => r.check.key).join(', ')})`;

  const row = (n: Note) => `<tr>
    <td style="padding:6px 12px 6px 0;color:${n.kind === 'alert' ? (n.check.severity === 'CRITICAL' ? '#EF4444' : '#EAB308') : '#22C55E'};white-space:nowrap">
      ${n.kind === 'alert' ? (n.check.severity === 'CRITICAL' ? 'DOWN' : 'WARN') : 'RECOVERED'}</td>
    <td style="padding:6px 0;color:#F0F0F0">${n.check.message}</td></tr>`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `${BRAND.name} Monitor <${fromEmail}>`,
      to: ALERT_TO,
      subject,
      html: `<div style="font-family:monospace;max-width:640px">
        <h2 style="color:#F5A623;margin:0 0 4px">${BRAND.name} — generation health</h2>
        <table style="font-size:13px;border-collapse:collapse;margin-top:12px">${notes.map(row).join('')}</table>
        <p style="color:#8A8A8A;font-size:12px;margin-top:16px">
          Logs: https://vercel.com/kelcwu-gmailcoms-projects/setlab &nbsp;·&nbsp; runtime query the generate-setlist endpoint.
        </p>
      </div>`,
    });
  } catch (err) {
    console.error('[health-check] alert email failed', err);
  }
}

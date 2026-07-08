'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SD } from '@/lib/setdrop/constants';
import { SDButton } from '@/components/setdrop/shared';
import type { AdminMetrics, AdminUserRow, AdminSetlistRow } from '@/lib/admin-data';

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 150, background: SD.surface, border: `1px solid ${SD.border}`,
      borderRadius: SD.r3, padding: '18px 20px',
    }}>
      <div style={{ fontFamily: SD.mono, fontSize: SD.t10, letterSpacing: 2, textTransform: 'uppercase', color: SD.textMuted }}>
        {label}
      </div>
      <div style={{ fontFamily: SD.display, fontSize: SD.t40, letterSpacing: 1, color: SD.text, lineHeight: 1.1, marginTop: 6 }}>
        {value}
      </div>
      {sub && <div style={{ fontFamily: SD.mono, fontSize: SD.t11, color: SD.textSec, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function AdminDashboard({
  metrics, users, adminEmail,
}: {
  metrics: AdminMetrics;
  users: AdminUserRow[];
  adminEmail: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.email ?? '').toLowerCase().includes(q));
  }, [query, users]);

  const proPct = metrics.totalUsers ? ((metrics.proCount / metrics.totalUsers) * 100).toFixed(1) : '0';
  const maxSignup = Math.max(1, ...metrics.signups14d.map((d) => d.count));

  async function act(id: string, action: string) {
    setBusyId(id); setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'Action failed');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally { setBusyId(null); }
  }

  async function del(id: string, email: string | null) {
    if (!window.confirm(`Permanently delete ${email ?? 'this user'} and ALL of their data? This cannot be undone.`)) return;
    setBusyId(id); setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'Delete failed');
      setExpandedId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally { setBusyId(null); }
  }

  const th: React.CSSProperties = {
    fontFamily: SD.mono, fontSize: SD.t10, letterSpacing: 1.5, textTransform: 'uppercase',
    color: SD.textMuted, textAlign: 'left', padding: '10px 12px', fontWeight: 400,
  };
  const td: React.CSSProperties = {
    fontFamily: SD.mono, fontSize: SD.t12, color: SD.textSec, padding: '10px 12px', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ background: SD.bg, minHeight: '100vh', color: SD.text, paddingTop: 56 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 40px 96px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontFamily: SD.mono, fontSize: SD.t10, letterSpacing: 3, textTransform: 'uppercase', color: SD.textMuted }}>
              Admin
            </div>
            <h1 style={{ fontFamily: SD.display, fontSize: SD.t28, letterSpacing: 2, margin: '4px 0 0' }}>
              CONTROL ROOM
            </h1>
          </div>
          <div style={{ fontFamily: SD.mono, fontSize: SD.t11, color: SD.textMuted }}>{adminEmail}</div>
        </div>

        {/* Metric cards */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <MetricCard label="Users" value={metrics.totalUsers.toLocaleString()} sub={`+${metrics.newUsers7d} last 7d`} />
          <MetricCard label="Pro" value={metrics.proCount.toLocaleString()} sub={`${proPct}% of users`} />
          <MetricCard label="MRR" value={`$${metrics.mrr.toLocaleString()}`} sub="pro × $12" />
          <MetricCard label="AI calls" value={metrics.aiCalls24h.toLocaleString()} sub="last 24h" />
        </div>

        {/* Signups strip */}
        <div style={{ background: SD.surface, border: `1px solid ${SD.border}`, borderRadius: SD.r3, padding: '16px 20px', marginBottom: 28 }}>
          <div style={{ fontFamily: SD.mono, fontSize: SD.t10, letterSpacing: 2, textTransform: 'uppercase', color: SD.textMuted, marginBottom: 12 }}>
            Signups · last 14 days
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 56 }}>
            {metrics.signups14d.map((d) => (
              <div key={d.date} title={`${d.date}: ${d.count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{
                  width: '100%', borderRadius: 2,
                  height: `${Math.max(3, (d.count / maxSignup) * 52)}px`,
                  background: d.count > 0 ? SD.accent : SD.surface3,
                }} />
              </div>
            ))}
          </div>
        </div>

        {/* Users */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: SD.mono, fontSize: SD.t13, color: SD.text, letterSpacing: 1 }}>
            Users <span style={{ color: SD.textMuted }}>({filtered.length})</span>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search email…"
            style={{
              background: SD.surface2, border: `1px solid ${SD.border}`, borderRadius: SD.r2,
              padding: '8px 12px', color: SD.text, fontFamily: SD.mono, fontSize: SD.t12,
              outline: 'none', width: 240,
            }}
          />
        </div>

        {error && (
          <div style={{ fontFamily: SD.mono, fontSize: SD.t12, color: SD.danger, background: SD.dangerDim, border: `1px solid ${SD.danger}33`, borderRadius: SD.r2, padding: '8px 12px', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ background: SD.surface, border: `1px solid ${SD.border}`, borderRadius: SD.r3, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${SD.border}` }}>
                <th style={th}>Email</th>
                <th style={th}>Tier</th>
                <th style={th}>Joined</th>
                <th style={{ ...th, textAlign: 'right' }}>Lib</th>
                <th style={{ ...th, textAlign: 'right' }}>Sets</th>
                <th style={{ ...th, textAlign: 'right' }}>IDs/mo</th>
                <th style={{ ...th, textAlign: 'right' }}>Last</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const open = expandedId === u.id;
                const busy = busyId === u.id;
                return (
                  <React.Fragment key={u.id}>
                    <tr
                      onClick={() => setExpandedId(open ? null : u.id)}
                      style={{ borderTop: `1px solid ${SD.border}`, cursor: 'pointer', background: open ? SD.surface2 : 'transparent' }}
                    >
                      <td style={{ ...td, color: SD.text }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          {u.email ?? '—'}
                          {u.isBanned && <Tag color={SD.danger}>BANNED</Tag>}
                          {u.isBeta && <Tag color={SD.info}>BETA</Tag>}
                        </span>
                      </td>
                      <td style={td}>
                        {u.tier === 'pro'
                          ? <Tag color={SD.accent}>PRO</Tag>
                          : <span style={{ color: SD.textMuted }}>free</span>}
                      </td>
                      <td style={td}>{shortDate(u.createdAt)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{u.libraryTracks.toLocaleString()}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{u.setlistCount}</td>
                      <td style={{ ...td, textAlign: 'right', color: u.trackIdsThisMonth >= 10 ? SD.warning : SD.textSec }}>
                        {u.trackIdsThisMonth}
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: SD.textMuted }}>{timeAgo(u.lastSignInAt)}</td>
                    </tr>
                    {open && (
                      <tr style={{ background: SD.surface2 }}>
                        <td colSpan={7} style={{ padding: '4px 12px 16px' }}>
                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <SDButton small ghost disabled={busy} onClick={() => act(u.id, u.tier === 'pro' ? 'revoke_pro' : 'grant_pro')}>
                              {u.tier === 'pro' ? 'Revoke Pro' : 'Grant Pro'}
                            </SDButton>
                            <SDButton small ghost disabled={busy} onClick={() => act(u.id, u.isBeta ? 'unset_beta' : 'set_beta')}>
                              {u.isBeta ? 'Remove Beta' : 'Add Beta'}
                            </SDButton>
                            <SDButton small ghost disabled={busy} onClick={() => act(u.id, u.isBanned ? 'unban' : 'ban')}>
                              {u.isBanned ? 'Unban' : 'Ban'}
                            </SDButton>
                            <div style={{ flex: 1 }} />
                            <button
                              disabled={busy}
                              onClick={() => del(u.id, u.email)}
                              style={{
                                fontFamily: SD.mono, fontSize: SD.t11, letterSpacing: 0.5,
                                color: SD.danger, background: SD.dangerDim,
                                border: `1px solid ${SD.danger}44`, borderRadius: SD.r2,
                                padding: '6px 12px', cursor: busy ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {busy ? '…' : 'Delete user'}
                            </button>
                          </div>

                          {/* Library source */}
                          <div style={{ fontFamily: SD.mono, fontSize: SD.t11, color: SD.textMuted, marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ letterSpacing: 1, textTransform: 'uppercase', fontSize: SD.t10 }}>Library</span>
                            {u.librarySource
                              ? <Tag color={u.librarySource === 'rekordbox' ? SD.info : SD.accent}>{u.librarySource.toUpperCase()}</Tag>
                              : <span style={{ color: SD.textMuted }}>—</span>}
                            {u.libraryTracks > 0 && <span style={{ color: SD.textMuted }}>{u.libraryTracks.toLocaleString()} tracks</span>}
                          </div>

                          {/* Sets */}
                          {u.sets.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <div style={{ fontFamily: SD.mono, fontSize: SD.t10, letterSpacing: 1, textTransform: 'uppercase', color: SD.textMuted, marginBottom: 6 }}>
                                Sets ({u.sets.length})
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {u.sets.map((s) => <SetRow key={s.id} set={s} />)}
                              </div>
                            </div>
                          )}

                          <div style={{ fontFamily: SD.mono, fontSize: SD.t10, color: SD.textMuted, marginTop: 10, opacity: 0.5 }}>
                            {u.id}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: SD.textMuted, padding: '32px' }}>No users match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SetRow({ set }: { set: AdminSetlistRow }) {
  const meta = [
    set.primaryGenre,
    set.crowdContext,
    set.durationMinutes ? `${set.durationMinutes}min` : null,
    set.trackCount ? `${set.trackCount} tracks` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 4, padding: '6px 10px', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 12, color: '#F0F0F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {set.name}
        </div>
        {meta && (
          <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, color: '#6A6A6A', marginTop: 2 }}>
            {meta}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, color: '#4A4A4A' }}>
          {shortDate(set.createdAt)}
        </span>
        {set.isPublic && set.shareUrl ? (
          <a
            href={`/set/${set.shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              fontFamily: 'var(--font-mono), monospace', fontSize: 10, letterSpacing: 0.5,
              color: '#F5A623', textDecoration: 'none',
              border: '1px solid rgba(245,166,35,0.3)', borderRadius: 3, padding: '2px 7px',
            }}
          >
            VIEW →
          </a>
        ) : (
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, color: '#3A3A3A' }}>private</span>
        )}
      </div>
    </div>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      fontFamily: SD.mono, fontSize: SD.t10, letterSpacing: 1, textTransform: 'uppercase',
      color, background: `${color}1F`, border: `1px solid ${color}44`,
      borderRadius: SD.r1, padding: '1px 6px',
    }}>
      {children}
    </span>
  );
}

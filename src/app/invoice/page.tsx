'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SD } from '@/lib/setdrop/constants';
import type { InvoiceData, LineItem } from '@/lib/invoice/types';

function genInvoiceNumber(): string {
  const d = new Date();
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `INV-${yyyymmdd}-${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function newItem(): LineItem {
  return { id: crypto.randomUUID(), description: '', qty: 1, rate: 0 };
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

export default function InvoicePage() {
  const router = useRouter();
  const logoRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<InvoiceData>(() => {
    const t = todayStr();
    return {
      djName: '', company: '', djEmail: '', djPhone: '', logo: '',
      clientName: '', clientEmail: '',
      eventName: '', eventDate: '', venue: '',
      invoiceNumber: genInvoiceNumber(),
      issueDate: t, dueDate: addDays(t, 30),
      currency: 'USD',
      lineItems: [newItem()],
      notes: '',
    };
  });

  const [downloading, setDownloading] = useState(false);
  const [sendEmail, setSendEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState('');

  function set<K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) {
    setData(prev => ({ ...prev, [key]: value }));
  }

  function updateItem(id: string, field: keyof LineItem, value: string | number) {
    setData(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(item => item.id === id ? { ...item, [field]: value } : item),
    }));
  }

  function addItem() {
    setData(prev => ({ ...prev, lineItems: [...prev.lineItems, newItem()] }));
  }

  function removeItem(id: string) {
    setData(prev => ({ ...prev, lineItems: prev.lineItems.filter(i => i.id !== id) }));
  }

  const total = data.lineItems.reduce((sum, i) => sum + i.qty * i.rate, 0);

  function formatMoney(n: number) {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency }).format(n);
    } catch {
      return `${data.currency} ${n.toFixed(2)}`;
    }
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set('logo', ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch('/api/invoice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${data.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }

  async function handleSend() {
    if (!sendEmail) return;
    setSending(true);
    setSendSuccess(false);
    setSendError('');
    try {
      const res = await fetch('/api/invoice/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceData: data, recipientEmail: sendEmail }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Send failed');
      setSendSuccess(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  const canSubmit = !!data.djName && !!data.clientName && data.lineItems.length > 0;

  // Shared styles
  const inputStyle: React.CSSProperties = {
    background: SD.surface2, border: `1px solid ${SD.border}`, borderRadius: 3,
    padding: '10px 12px', color: SD.text, fontFamily: SD.mono, fontSize: 12,
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 9, color: SD.textSec, letterSpacing: 1.5,
    marginBottom: 5, textTransform: 'uppercase', fontFamily: SD.mono,
  };
  const sectionStyle: React.CSSProperties = {
    background: SD.surface, border: `1px solid ${SD.border}`, borderRadius: 4,
    padding: '24px', marginBottom: 16,
  };
  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: SD.mono, fontSize: 10, color: SD.accent, letterSpacing: 2,
    marginBottom: 20, textTransform: 'uppercase',
  };
  const rowStyle: React.CSSProperties = { display: 'flex', gap: 16, marginBottom: 14 };

  return (
    <div style={{
      background: SD.bg, minHeight: '100vh', fontFamily: SD.mono,
      backgroundImage: `
        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
      `,
      backgroundSize: '60px 60px',
      padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={{ fontFamily: SD.display, fontSize: 28, letterSpacing: 4, color: SD.text }}>
              SET<span style={{ color: SD.accent }}>DROP</span>
            </div>
            <div style={{ fontSize: 11, color: SD.textSec, letterSpacing: 2, marginTop: 4 }}>INVOICE GENERATOR</div>
          </div>
          <span
            onClick={() => router.back()}
            style={{ fontSize: 11, color: SD.textSec, cursor: 'pointer', letterSpacing: 1 }}
          >
            ← BACK
          </span>
        </div>

        {/* Your Information */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Your Information</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ flex: 1 }}>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <span style={labelStyle}>DJ Name *</span>
                  <input style={inputStyle} value={data.djName} onChange={e => set('djName', e.target.value)} placeholder="DJ Khaled" />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={labelStyle}>Company</span>
                  <input style={inputStyle} value={data.company} onChange={e => set('company', e.target.value)} placeholder="We The Best Music" />
                </div>
              </div>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <span style={labelStyle}>Email</span>
                  <input style={inputStyle} type="email" value={data.djEmail} onChange={e => set('djEmail', e.target.value)} placeholder="dj@example.com" />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={labelStyle}>Phone</span>
                  <input style={inputStyle} value={data.djPhone} onChange={e => set('djPhone', e.target.value)} placeholder="+1 (555) 000-0000" />
                </div>
              </div>
            </div>
            {/* Logo upload */}
            <div style={{ width: 116, flexShrink: 0 }}>
              <span style={labelStyle}>Logo</span>
              <div
                onClick={() => logoRef.current?.click()}
                style={{
                  width: 116, height: 116,
                  background: SD.surface2, border: `1px dashed ${data.logo ? SD.accent : SD.borderMid}`,
                  borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', overflow: 'hidden',
                }}
              >
                {data.logo ? (
                  <img src={data.logo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="logo" />
                ) : (
                  <div style={{ textAlign: 'center', color: SD.textMuted }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>+</div>
                    <div style={{ fontSize: 9, letterSpacing: 1 }}>UPLOAD</div>
                  </div>
                )}
              </div>
              {data.logo && (
                <button
                  onClick={() => set('logo', '')}
                  style={{ marginTop: 6, background: 'none', border: 'none', color: SD.textSec, fontSize: 10, cursor: 'pointer', padding: 0, fontFamily: SD.mono, letterSpacing: 1 }}
                >
                  REMOVE
                </button>
              )}
              <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
            </div>
          </div>
        </div>

        {/* Client & Event */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Client & Event</div>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Client Name *</span>
              <input style={inputStyle} value={data.clientName} onChange={e => set('clientName', e.target.value)} placeholder="John Smith" />
            </div>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Client Email</span>
              <input style={inputStyle} type="email" value={data.clientEmail} onChange={e => set('clientEmail', e.target.value)} placeholder="client@example.com" />
            </div>
          </div>
          <div style={rowStyle}>
            <div style={{ flex: 2 }}>
              <span style={labelStyle}>Event Name</span>
              <input style={inputStyle} value={data.eventName} onChange={e => set('eventName', e.target.value)} placeholder="Wedding Reception" />
            </div>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Event Date</span>
              <input style={inputStyle} type="date" value={data.eventDate} onChange={e => set('eventDate', e.target.value)} />
            </div>
          </div>
          <div>
            <span style={labelStyle}>Venue</span>
            <input style={inputStyle} value={data.venue} onChange={e => set('venue', e.target.value)} placeholder="Grand Ballroom, NYC" />
          </div>
        </div>

        {/* Invoice Details */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Invoice Details</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Invoice Number</span>
              <input style={inputStyle} value={data.invoiceNumber} onChange={e => set('invoiceNumber', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Issue Date</span>
              <input style={inputStyle} type="date" value={data.issueDate} onChange={e => set('issueDate', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Due Date</span>
              <input style={inputStyle} type="date" value={data.dueDate} onChange={e => set('dueDate', e.target.value)} />
            </div>
            <div style={{ width: 90 }}>
              <span style={labelStyle}>Currency</span>
              <select
                value={data.currency}
                onChange={e => set('currency', e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Line Items</div>
          {/* Header row */}
          <div style={{ display: 'flex', gap: 8, paddingBottom: 8, borderBottom: `1px solid ${SD.border}`, marginBottom: 8 }}>
            <div style={{ flex: 4, fontSize: 9, color: SD.textSec, letterSpacing: 1.5 }}>DESCRIPTION</div>
            <div style={{ width: 64, fontSize: 9, color: SD.textSec, letterSpacing: 1.5, textAlign: 'center' }}>QTY</div>
            <div style={{ width: 104, fontSize: 9, color: SD.textSec, letterSpacing: 1.5, textAlign: 'right' }}>RATE</div>
            <div style={{ width: 104, fontSize: 9, color: SD.textSec, letterSpacing: 1.5, textAlign: 'right' }}>AMOUNT</div>
            <div style={{ width: 32 }} />
          </div>
          {data.lineItems.map(item => (
            <div key={item.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <div style={{ flex: 4 }}>
                <input
                  style={inputStyle}
                  value={item.description}
                  onChange={e => updateItem(item.id, 'description', e.target.value)}
                  placeholder="DJ Set — 4 hours"
                />
              </div>
              <div style={{ width: 64 }}>
                <input
                  style={{ ...inputStyle, textAlign: 'center' }}
                  type="number"
                  min="1"
                  value={item.qty}
                  onChange={e => updateItem(item.id, 'qty', Number(e.target.value))}
                />
              </div>
              <div style={{ width: 104 }}>
                <input
                  style={{ ...inputStyle, textAlign: 'right' }}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.rate || ''}
                  onChange={e => updateItem(item.id, 'rate', Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              <div style={{ width: 104, textAlign: 'right', fontSize: 12, color: SD.text, flexShrink: 0 }}>
                {formatMoney(item.qty * item.rate)}
              </div>
              <button
                onClick={() => removeItem(item.id)}
                disabled={data.lineItems.length === 1}
                style={{
                  width: 32, height: 36, background: 'none',
                  border: `1px solid ${SD.border}`, borderRadius: 3,
                  cursor: data.lineItems.length === 1 ? 'not-allowed' : 'pointer',
                  color: data.lineItems.length === 1 ? SD.textMuted : SD.textSec,
                  fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontFamily: SD.mono,
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={addItem}
            style={{
              marginTop: 4, background: 'none', border: `1px dashed ${SD.borderMid}`, borderRadius: 3,
              padding: '8px 16px', color: SD.textSec, fontFamily: SD.mono, fontSize: 11,
              letterSpacing: 1, cursor: 'pointer',
            }}
          >
            + ADD ITEM
          </button>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingTop: 16, borderTop: `1px solid ${SD.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <span style={{ fontSize: 10, color: SD.textSec, letterSpacing: 1.5 }}>TOTAL</span>
              <span style={{ fontSize: 22, color: SD.accent, fontWeight: 700 }}>{formatMoney(total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Notes</div>
          <textarea
            value={data.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Payment due within 30 days. Bank transfer preferred."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 60 }}>
          <button
            onClick={handleDownload}
            disabled={downloading || !canSubmit}
            style={{
              width: '100%', padding: '14px',
              background: !canSubmit ? SD.surface3 : downloading ? SD.surface3 : SD.accent,
              color: !canSubmit ? SD.textMuted : downloading ? SD.textSec : '#000',
              border: 'none', borderRadius: 3, fontFamily: SD.mono, fontSize: 12,
              fontWeight: 700, letterSpacing: 1.5, cursor: !canSubmit || downloading ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {downloading ? 'GENERATING PDF...' : '↓ DOWNLOAD PDF'}
          </button>

          <div style={{ background: SD.surface, border: `1px solid ${SD.border}`, borderRadius: 4, padding: '20px 24px' }}>
            <div style={{ fontSize: 10, color: SD.accent, letterSpacing: 2, marginBottom: 14, textTransform: 'uppercase' }}>
              Send to Client
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                type="email"
                value={sendEmail}
                onChange={e => { setSendEmail(e.target.value); setSendSuccess(false); setSendError(''); }}
                placeholder={data.clientEmail || 'client@example.com'}
              />
              <button
                onClick={handleSend}
                disabled={sending || !sendEmail || !canSubmit}
                style={{
                  padding: '10px 24px', background: SD.surface3,
                  border: `1px solid ${SD.borderMid}`, borderRadius: 3,
                  color: sending || !sendEmail || !canSubmit ? SD.textMuted : SD.text,
                  fontFamily: SD.mono, fontSize: 11, letterSpacing: 1,
                  cursor: sending || !sendEmail || !canSubmit ? 'not-allowed' : 'pointer',
                  flexShrink: 0, whiteSpace: 'nowrap',
                }}
              >
                {sending ? 'SENDING...' : 'SEND EMAIL'}
              </button>
            </div>
            {sendSuccess && (
              <div style={{ marginTop: 10, fontSize: 11, color: SD.green }}>✓ Invoice sent successfully</div>
            )}
            {sendError && (
              <div style={{ marginTop: 10, fontSize: 11, color: SD.red }}>{sendError}</div>
            )}
            <div style={{ marginTop: 10, fontSize: 10, color: SD.textMuted }}>
              Requires RESEND_API_KEY + RESEND_FROM_EMAIL in env vars
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

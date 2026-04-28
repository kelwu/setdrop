'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { SD } from '@/lib/setdrop/constants';

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'auth_failed') setError('Authentication failed. Please try again.');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
      });
      if (error) setError(error.message);
      else setMessage('Check your email for a confirmation link.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push('/?goto=dashboard');
    }

    setLoading(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: SD.surface2,
    border: `1px solid ${SD.border}`, borderRadius: 3,
    padding: '12px 14px', color: SD.text,
    fontFamily: SD.mono, fontSize: 13, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color .15s',
  };

  return (
    <div style={{
      background: SD.bg, minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: SD.mono,
      backgroundImage: `
        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
      `,
      backgroundSize: '60px 60px',
    }}>
      <div style={{
        width: '100%', maxWidth: 400, margin: '0 20px',
        background: SD.surface, border: `1px solid ${SD.border}`,
        borderRadius: 4, padding: '40px 36px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontFamily: SD.display, fontSize: 32, letterSpacing: 4, color: SD.text,
          }}>
            SET<span style={{ color: SD.accent }}>DROP</span>
          </div>
          <div style={{ fontSize: 11, color: SD.textSec, letterSpacing: 1.5, marginTop: 6 }}>
            {mode === 'signin' ? 'SIGN IN TO CONTINUE' : 'CREATE YOUR ACCOUNT'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: SD.textSec, letterSpacing: 1.5, marginBottom: 6 }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = SD.borderMid)}
              onBlur={e => (e.target.style.borderColor = SD.border)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 10, color: SD.textSec, letterSpacing: 1.5, marginBottom: 6 }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = SD.borderMid)}
              onBlur={e => (e.target.style.borderColor = SD.border)}
            />
          </div>

          {error && (
            <div style={{
              background: SD.redDim, border: `1px solid ${SD.red}33`,
              borderRadius: 3, padding: '10px 14px',
              fontSize: 12, color: SD.red,
            }}>
              {error}
            </div>
          )}

          {message && (
            <div style={{
              background: SD.greenDim, border: `1px solid ${SD.green}33`,
              borderRadius: 3, padding: '10px 14px',
              fontSize: 12, color: SD.green,
            }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', marginTop: 4,
              background: loading ? SD.surface3 : SD.accent,
              color: loading ? SD.textSec : '#000',
              border: 'none', borderRadius: 3, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: SD.mono, fontSize: 11, fontWeight: 700,
              letterSpacing: 1.5, textTransform: 'uppercase',
              transition: 'background .15s',
            }}
          >
            {loading ? 'LOADING...' : mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <div style={{
          textAlign: 'center', marginTop: 24,
          fontSize: 11, color: SD.textSec,
        }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <span
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); }}
            style={{ color: SD.accent, cursor: 'pointer', textDecoration: 'underline' }}
          >
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </span>
        </div>

        <div style={{
          textAlign: 'center', marginTop: 20,
          fontSize: 11, color: SD.textMuted,
        }}>
          <span
            onClick={() => router.push('/')}
            style={{ cursor: 'pointer' }}
          >
            ← Back to home
          </span>
        </div>
      </div>
    </div>
  );
}

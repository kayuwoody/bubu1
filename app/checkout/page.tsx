'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { CartLine } from '@/lib/types';
import MENU_DATA from '@/lib/menu-data';

const INK  = '#3A2414';
const BG   = '#FFF6E8';
const PRI  = '#F58220';
const R    = 22;

function hex(h: string, a = 1) {
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

interface Pending {
  lines:   CartLine[];
  pickup:  'counter' | 'curbside';
  total:   number;
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const cancelled    = searchParams.get('cancelled') === '1';

  const [pending, setPending] = useState<Pending | null>(null);
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const CHANNELS = [
    { value: 'fpx',          label: 'Online Banking (FPX)' },
    { value: 'TNG-EWALLET',  label: "Touch 'n Go eWallet" },
    { value: 'GrabPay',      label: 'GrabPay' },
    { value: 'BOOST',        label: 'Boost' },
    { value: 'creditAN',     label: 'Credit / Debit Card' },
  ];

  useEffect(() => {
    try {
      const raw = localStorage.getItem('co_pending');
      if (raw) setPending(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  if (!pending) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: BG, fontFamily: "'Nunito', system-ui" }}>
        <div style={{ textAlign: 'center', color: INK }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>No active cart</div>
          <a href="/" style={{ color: PRI, marginTop: 12, display: 'block' }}>← Back to menu</a>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !phone.trim()) { setError('Name and phone are required.'); return; }
    if (!channel) { setError('Please select a payment method.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          pickup: pending.pickup,
          items: pending.lines,
          total: pending.total,
          channel,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Checkout failed.'); setLoading(false); return; }
      localStorage.setItem('co_session', data.sessionId);

      // POST to Fiuu hosted payment page via a hidden form
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.fiuuAction;
      for (const [k, v] of Object.entries(data.fiuuFields as Record<string, string>)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = v;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
      // loading stays true — browser is navigating away
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const itemNames = pending.lines.map(l => {
    const item = MENU_DATA.items.find(i => i.id === l.id);
    return `${l.qty}× ${item?.name ?? l.id}`;
  }).join(', ');

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Nunito', system-ui", padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <a href="/" style={{ color: hex(INK, .55), fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>← Back to menu</a>

        {cancelled && (
          <div style={{ background: '#FFF3CD', border: '1px solid #FFEAA7', borderRadius: R - 8, padding: '12px 16px', marginBottom: 20, color: '#856404', fontSize: 14 }}>
            Payment was cancelled. You can try again below.
          </div>
        )}

        <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 28, color: INK, marginBottom: 4 }}>Checkout</div>
        <div style={{ fontSize: 14, color: hex(INK, .6), marginBottom: 24 }}>{itemNames}</div>

        {/* Order summary */}
        <div style={{ background: '#fff', borderRadius: R, border: `1.5px solid ${hex(INK, .08)}`, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: hex(INK, .65) }}>
            <span>Pickup</span>
            <span style={{ fontWeight: 700, color: INK }}>{pending.pickup === 'curbside' ? 'Curbside' : 'At counter'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 20, color: INK, borderTop: `1px solid ${hex(INK, .06)}`, paddingTop: 8, marginTop: 4 }}>
            <span>Total</span>
            <span>RM {pending.total.toFixed(2)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Name', value: name, set: setName, type: 'text', placeholder: 'Your name', required: true },
              { label: 'Phone', value: phone, set: setPhone, type: 'tel', placeholder: 'e.g. 0123456789', required: true },
              { label: 'Email (optional)', value: email, set: setEmail, type: 'email', placeholder: 'For receipt', required: false },
            ].map(({ label, value, set, type, placeholder, required }) => (
              <div key={label}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: hex(INK, .65), marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</label>
                <input
                  type={type}
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  required={required}
                  style={{ width: '100%', padding: '14px 16px', fontSize: 16, color: INK, background: '#fff', border: `1.5px solid ${hex(INK, .12)}`, borderRadius: R - 8, outline: 'none', fontFamily: "'Nunito', system-ui" }}
                />
              </div>
            ))}
          </div>

          {/* Payment method */}
          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: hex(INK, .65), marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>Payment Method</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {CHANNELS.map(c => (
                <label key={c.value} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#fff', border: `1.5px solid ${channel === c.value ? PRI : hex(INK, .12)}`, borderRadius: R - 8, cursor: 'pointer', fontSize: 15, color: INK, fontWeight: channel === c.value ? 700 : 400 }}>
                  <input type="radio" name="channel" value={c.value} checked={channel === c.value} onChange={() => setChannel(c.value)} style={{ accentColor: PRI }} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: R - 8, color: '#C0392B', fontSize: 14 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 24, width: '100%', padding: '16px',
              background: loading ? hex(PRI, .6) : PRI,
              color: '#fff', border: 'none', borderRadius: R,
              fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 17,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : `0 6px 0 ${hex(PRI, .4)}`,
            }}
          >
            {loading ? 'Redirecting to payment…' : `Pay RM ${pending.total.toFixed(2)} →`}
          </button>

          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: hex(INK, .5) }}>
            FPX · GrabPay · Boost · Touch 'n Go
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#FFF6E8' }}/>}>
      <CheckoutContent />
    </Suspense>
  );
}

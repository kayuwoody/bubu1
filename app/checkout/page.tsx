'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { CartLine, LoyaltySettings } from '@/lib/types';

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

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 700,
  color: `rgba(58,36,20,.65)`, marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '.04em',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '14px 16px', fontSize: 16,
  color: INK, background: '#fff',
  border: `1.5px solid rgba(58,36,20,.12)`,
  borderRadius: R - 8, outline: 'none',
  fontFamily: "'Nunito', system-ui",
};

function LoyaltyChip({
  settings, customer, lookingUp, total,
}: {
  settings: LoyaltySettings | null;
  customer: { name: string | null; points_balance: number } | null;
  lookingUp: boolean;
  total: number;
}) {
  if (!settings?.is_active) return null;
  const toEarn = Math.floor(total * settings.points_per_rm);
  if (toEarn <= 0 && !customer && !lookingUp) return null;

  const hasCustomer = !!customer;
  return (
    <div style={{
      marginTop: 8, padding: '9px 13px',
      borderRadius: R - 10,
      background: hasCustomer ? '#FFFBEB' : `rgba(58,36,20,.03)`,
      border: `1px solid ${hasCustomer ? '#FDE68A' : `rgba(58,36,20,.07)`}`,
      fontSize: 13, display: 'flex', alignItems: 'center', gap: 7,
    }}>
      <span style={{ fontSize: 15 }}>⭐</span>
      {lookingUp ? (
        <span style={{ color: `rgba(58,36,20,.45)` }}>Checking loyalty…</span>
      ) : hasCustomer ? (
        <span style={{ color: '#92400E' }}>
          Hi {customer!.name ?? 'there'}!{' '}
          <strong>{customer!.points_balance.toLocaleString()} pts</strong> balance
          {toEarn > 0 && <> · +{toEarn} pts on this order</>}
        </span>
      ) : (
        <span style={{ color: `rgba(58,36,20,.55)` }}>
          Earn <strong>{toEarn} pts</strong> on this order
        </span>
      )}
    </div>
  );
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

  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings | null>(null);
  const [customer, setCustomer] = useState<{ name: string | null; points_balance: number } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

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

  // Restore saved form data (populated on prior submit; survives cancel/retry)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('co_form');
      if (saved) {
        const { name: n, email: em, phone: ph, channel: ch } = JSON.parse(saved);
        if (n)  setName(n);
        if (em) setEmail(em);
        if (ph) setPhone(ph);
        if (ch) setChannel(ch);
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch loyalty config once on mount
  useEffect(() => {
    fetch('/api/loyalty')
      .then(r => r.json())
      .then(d => setLoyaltySettings(d.settings ?? null))
      .catch(() => {});
  }, []);

  // Debounced customer lookup by phone
  useEffect(() => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) { setCustomer(null); return; }
    setLookingUp(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customer?phone=${digits}`);
        setCustomer(res.ok ? await res.json() : null);
      } catch { setCustomer(null); }
      finally  { setLookingUp(false); }
    }, 700);
    return () => { clearTimeout(timer); setLookingUp(false); };
  }, [phone]);

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
    // Persist form fields so they survive a cancel/retry cycle
    try { localStorage.setItem('co_form', JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim(), channel })); } catch { /* ignore */ }
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

      // Load jQuery (required by Fiuu Seamless SDK)
      await loadScript('https://ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min.js');

      // Intercept ALL network calls to Fiuu's domain before loading the SDK,
      // routing them through our server-side proxy to avoid CORS on the verify call.
      // Covers jQuery AJAX, native XHR, and fetch — whichever the SDK uses.
      const FIUU_RE = /sandbox-payment\.fiuu\.com|pay\.fiuu\.com|molpay\.com|razer\.com/;
      const proxyCall = (url: string, method: string, body: string) =>
        fetch('/api/fiuu/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, method, body }),
        });

      // 1. jQuery ajaxPrefilter
      (window as any).jQuery.ajaxPrefilter((opts: any) => {
        if (opts.url && FIUU_RE.test(opts.url)) {
          console.log('[mps-proxy] jQuery intercepted:', opts.type, opts.url);
          const u = opts.url, m = (opts.type || 'GET').toUpperCase(), b = typeof opts.data === 'string' ? opts.data : '';
          opts.url = '/api/fiuu/proxy'; opts.type = 'POST'; opts.contentType = 'application/json';
          opts.data = JSON.stringify({ url: u, method: m, body: b });
        }
      });

      // 2. Native XHR
      const _XHR = (window as any).XMLHttpRequest;
      (window as any).XMLHttpRequest = function () {
        const xhr = new _XHR();
        let _p = false, _pu = '', _pm = '';
        const _open = xhr.open.bind(xhr), _setH = xhr.setRequestHeader.bind(xhr), _send = xhr.send.bind(xhr);
        xhr.open = (m: string, u: string, ...a: any[]) => {
          if (FIUU_RE.test(u)) { _p = true; _pu = u; _pm = m; console.log('[mps-proxy] XHR intercepted:', m, u); _open('POST', '/api/fiuu/proxy', ...a); }
          else _open(m, u, ...a);
        };
        xhr.setRequestHeader = (h: string, v: string) => { if (!_p) _setH(h, v); };
        xhr.send = (body?: any) => {
          if (_p) { _setH('Content-Type', 'application/json'); _send(JSON.stringify({ url: _pu, method: _pm, body: typeof body === 'string' ? body : '' })); }
          else _send(body);
        };
        return xhr;
      };
      (window as any).XMLHttpRequest.prototype = _XHR.prototype;

      // 3. Fetch API
      const _fetch = window.fetch.bind(window);
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const u = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as Request).url);
        if (FIUU_RE.test(u)) { console.log('[mps-proxy] fetch intercepted:', u); return proxyCall(u, init?.method || 'GET', (init?.body || '').toString()); }
        return _fetch(input, init);
      };

      // Load Fiuu Seamless SDK — all its network calls now go through our proxy
      await loadScript(data.scriptUrl);

      // Mirror the demo's role="molpayseamless" form pattern exactly:
      // create a hidden form with all mps params, point it at our passthrough
      // endpoint, and trigger submit — the SDK intercepts, POSTs, reads JSON, pays.
      const jQuery = (window as any).jQuery;
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/checkout/mps';
      form.setAttribute('role', 'molpayseamless');
      form.style.display = 'none';
      const allParams = {
        ...data.mpsParams,
        mpsparenturl: window.location.href,
      };
      for (const [k, v] of Object.entries(allParams as Record<string, unknown>)) {
        const inp = document.createElement('input');
        inp.type = 'hidden';
        inp.name = k;
        inp.value = String(v);
        form.appendChild(inp);
      }
      document.body.appendChild(form);
      jQuery(form).submit();

      // loading stays true — SDK is now driving the payment UI
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.');
      setLoading(false);
    }
  };

  const itemNames = pending.lines.map(l => `${l.qty}× ${l.name}`).join(', ');

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

            {/* Name */}
            <div>
              <label style={labelStyle}>Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required style={inputStyle} />
            </div>

            {/* Phone + loyalty chip */}
            <div>
              <label style={labelStyle}>Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 0123456789" required style={inputStyle} />
              <LoyaltyChip
                settings={loyaltySettings}
                customer={customer}
                lookingUp={lookingUp}
                total={pending.total}
              />
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>Email (optional)</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="For receipt" style={inputStyle} />
            </div>

          </div>

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
            {loading ? 'Loading payment…' : `Pay RM ${pending.total.toFixed(2)} →`}
          </button>

          {loading && (
            <a
              href="/checkout?cancelled=1"
              style={{
                position: 'fixed', top: 16, left: 16, zIndex: 99999,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#fff',
                border: `1.5px solid ${hex(INK, .15)}`,
                borderRadius: R - 8,
                padding: '10px 18px',
                fontSize: 14, fontWeight: 700, color: INK,
                textDecoration: 'none',
                boxShadow: '0 2px 16px rgba(0,0,0,.18)',
              }}
            >
              ← Cancel
            </a>
          )}

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

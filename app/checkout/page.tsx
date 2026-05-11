'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { CartLine, LoyaltyConfig } from '@/lib/types';

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
  config, member, lookingUp,
}: {
  config: LoyaltyConfig | null;
  member: { name: string | null; points_balance: number } | null;
  lookingUp: boolean;
}) {
  if (!config?.is_active) return null;
  const hasMember = !!member;
  if (!hasMember && !lookingUp) return null;

  return (
    <div style={{
      marginTop: 8, padding: '9px 13px',
      borderRadius: R - 10,
      background: hasMember ? '#FFFBEB' : `rgba(58,36,20,.03)`,
      border: `1px solid ${hasMember ? '#FDE68A' : `rgba(58,36,20,.07)`}`,
      fontSize: 13, display: 'flex', alignItems: 'center', gap: 7,
    }}>
      <span style={{ fontSize: 15 }}>⭐</span>
      {lookingUp ? (
        <span style={{ color: `rgba(58,36,20,.45)` }}>Checking loyalty…</span>
      ) : (
        <span style={{ color: '#92400E' }}>
          Hi {member!.name ?? 'there'}!{' '}
          <strong>{member!.points_balance.toLocaleString()} pts</strong>
          {config.threshold > 0 && (
            <> · {config.threshold - (member!.points_balance % config.threshold)} to next voucher</>
          )}
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

  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig | null>(null);
  const [loyaltyMember, setLoyaltyMember] = useState<{ name: string | null; points_balance: number } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [voucherCode,    setVoucherCode]    = useState('');
  const [voucherStatus,  setVoucherStatus]  = useState<'idle'|'checking'|'valid'|'invalid'>('idle');
  const [voucherMsg,     setVoucherMsg]     = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherType,    setVoucherType]    = useState<'fixed'|'percent'>('fixed');

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
      .then(d => setLoyaltyConfig(d.config ?? null))
      .catch(() => {});
  }, []);

  // Debounced loyalty member lookup by phone
  useEffect(() => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) { setLoyaltyMember(null); return; }
    setLookingUp(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/loyalty/member?phone=${digits}`);
        const d = res.ok ? await res.json() : null;
        setLoyaltyMember(d?.member ?? null);
      } catch { setLoyaltyMember(null); }
      finally  { setLookingUp(false); }
    }, 700);
    return () => { clearTimeout(timer); setLookingUp(false); };
  }, [phone]);

  const discountedTotal = (() => {
    if (voucherStatus !== 'valid' || !pending) return pending?.total ?? 0;
    if (voucherType === 'percent') return Math.max(0, pending.total * (1 - voucherDiscount / 100));
    return Math.max(0, pending.total - voucherDiscount);
  })();

  const applyVoucher = async () => {
    const code = voucherCode.trim().toUpperCase();
    if (!code) return;
    setVoucherStatus('checking');
    setVoucherMsg('');
    try {
      const res = await fetch('/api/vouchers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, order_total: pending?.total ?? 0 }),
      });
      const d = await res.json();
      if (d.valid) {
        setVoucherStatus('valid');
        setVoucherDiscount(d.voucher.discount_amount);
        setVoucherType(d.voucher.type);
        setVoucherMsg(
          d.voucher.type === 'percent'
            ? `${d.voucher.discount_amount}% off applied`
            : `RM ${d.voucher.discount_amount.toFixed(2)} off applied`,
        );
      } else {
        setVoucherStatus('invalid');
        setVoucherMsg(d.reason ?? 'Invalid voucher');
      }
    } catch {
      setVoucherStatus('invalid');
      setVoucherMsg('Could not check voucher. Try again.');
    }
  };

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
          total: discountedTotal,
          channel,
          ...(voucherStatus === 'valid' && voucherCode ? { voucher_code: voucherCode.trim().toUpperCase() } : {}),
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
          {voucherStatus === 'valid' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16A34A', marginBottom: 4 }}>
              <span>Voucher ({voucherCode.toUpperCase()})</span>
              <span>
                -{voucherType === 'percent'
                  ? `${voucherDiscount}% (RM ${(pending.total - discountedTotal).toFixed(2)})`
                  : `RM ${voucherDiscount.toFixed(2)}`}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 20, color: INK, borderTop: `1px solid ${hex(INK, .06)}`, paddingTop: 8, marginTop: 4 }}>
            <span>Total</span>
            <span>
              {voucherStatus === 'valid' && <span style={{ fontSize: 14, fontWeight: 400, color: hex(INK, .4), textDecoration: 'line-through', marginRight: 6 }}>RM {pending.total.toFixed(2)}</span>}
              RM {discountedTotal.toFixed(2)}
            </span>
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
                config={loyaltyConfig}
                member={loyaltyMember}
                lookingUp={lookingUp}
              />
            </div>

            {/* Voucher */}
            <div>
              <label style={labelStyle}>Voucher Code (optional)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={voucherCode}
                  onChange={e => {
                    setVoucherCode(e.target.value);
                    if (voucherStatus !== 'idle') { setVoucherStatus('idle'); setVoucherMsg(''); setVoucherDiscount(0); }
                  }}
                  placeholder="e.g. CO-ABC123"
                  style={{ ...inputStyle, flex: 1, textTransform: 'uppercase' }}
                  disabled={voucherStatus === 'valid'}
                />
                <button
                  type="button"
                  onClick={voucherStatus === 'valid' ? () => { setVoucherStatus('idle'); setVoucherCode(''); setVoucherMsg(''); setVoucherDiscount(0); } : applyVoucher}
                  disabled={voucherStatus === 'checking' || (!voucherCode.trim() && voucherStatus !== 'valid')}
                  style={{
                    padding: '14px 16px', borderRadius: R - 8, border: 'none', cursor: 'pointer',
                    background: voucherStatus === 'valid' ? '#16A34A' : INK,
                    color: '#fff', fontFamily: "'Nunito', system-ui", fontWeight: 700, fontSize: 14,
                    whiteSpace: 'nowrap', opacity: voucherStatus === 'checking' ? 0.6 : 1,
                  }}
                >
                  {voucherStatus === 'valid' ? '✓ Remove' : voucherStatus === 'checking' ? '…' : 'Apply'}
                </button>
              </div>
              {voucherMsg && (
                <div style={{ marginTop: 6, fontSize: 13, color: voucherStatus === 'valid' ? '#16A34A' : '#C0392B', fontWeight: 600 }}>
                  {voucherMsg}
                </div>
              )}
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
            {loading ? 'Loading payment…' : `Pay RM ${discountedTotal.toFixed(2)} →`}
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

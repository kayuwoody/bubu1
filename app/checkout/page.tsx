'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { normalisePhone, isValidMalaysianPhone } from '@/lib/normalisePhone';
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
          Hi {member!.name ?? 'there'}! Have a voucher code? Enter it below.
        </span>
      )}
    </div>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const cancelled    = searchParams.get('cancelled') === '1';
  const voucherParam = searchParams.get('voucher');

  const [pending, setPending] = useState<Pending | null>(null);
  const [pickup,  setPickup]  = useState<'counter'|'curbside'>('counter');
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig | null>(null);
  const [loyaltyMember, setLoyaltyMember] = useState<{ name: string | null; points_balance: number; programPoints: number } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [voucherCode,    setVoucherCode]    = useState('');
  const [voucherStatus,  setVoucherStatus]  = useState<'idle'|'checking'|'valid'|'invalid'>('idle');
  const [voucherMsg,     setVoucherMsg]     = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherType,    setVoucherType]    = useState<'fixed'|'percent'>('fixed');

  type PassOption = { id: string; code: string | null; points_balance: number; loyalty_programs: { id: string; name: string } | null };
  type PassEligibility = { ok: boolean; reason: string };
  const [availablePasses,  setAvailablePasses]  = useState<PassOption[]>([]);
  const [passEligibility,  setPassEligibility]  = useState<Record<string, PassEligibility>>({});
  const [selectedPass,     setSelectedPass]     = useState<PassOption | null>(null);
  const [passStatus,       setPassStatus]       = useState<'idle'|'checking'|'valid'|'invalid'>('idle');
  const [passMsg,          setPassMsg]          = useState('');
  const [passDiscount,     setPassDiscount]     = useState(0);
  const [passUsesApplied,  setPassUsesApplied]  = useState(0);
  const [copiedPass,       setCopiedPass]       = useState<string | null>(null);
  const [passQrPass,       setPassQrPass]       = useState<PassOption | null>(null);

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
      if (raw) {
        const p: Pending = JSON.parse(raw);
        setPending(p);
        setPickup(p.pickup ?? 'counter');
      }
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

  // Auto-apply voucher from URL param (navigated from /vouchers page)
  useEffect(() => {
    if (!voucherParam) return;
    const code = voucherParam.trim().toUpperCase();
    setVoucherCode(code);
    setVoucherStatus('checking');
    setVoucherMsg('');
    fetch('/api/vouchers/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, order_total: pending?.total ?? 0 }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.valid) {
          const amt = Number(d.voucher.discount_amount);
          setVoucherStatus('valid');
          setVoucherDiscount(amt);
          setVoucherType(d.voucher.type);
          setVoucherMsg(d.voucher.type === 'percent'
            ? `${amt}% off applied`
            : `RM ${amt.toFixed(2)} off applied`);
        } else {
          setVoucherStatus('invalid');
          setVoucherMsg(d.reason ?? 'Voucher could not be applied');
        }
      })
      .catch(() => { setVoucherStatus('invalid'); setVoucherMsg('Could not validate voucher. Try again.'); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucherParam]);

  // Fetch loyalty config once on mount
  useEffect(() => {
    fetch('/api/loyalty')
      .then(r => r.json())
      .then(d => setLoyaltyConfig(d.config ?? null))
      .catch(() => {});
  }, []);

  // Debounced loyalty member lookup by phone
  useEffect(() => {
    const digits = normalisePhone(phone);
    if (digits.length < 8) { setLoyaltyMember(null); return; }
    setLookingUp(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/loyalty/member?phone=${digits}`);
        const d = res.ok ? await res.json() : null;
        if (d?.member) {
          const pb = (d.programBalances ?? []).find(
            (p: { loyalty_programs: { id: string } | null }) => p.loyalty_programs?.id === loyaltyConfig?.id
          );
          setLoyaltyMember({ ...d.member, programPoints: pb?.points_balance ?? 0 });
          const passes = (d.programBalances ?? []).filter(
            (p: { points_balance: number; loyalty_programs: { trigger_type: string } | null }) =>
              p.loyalty_programs?.trigger_type === 'pass' && p.points_balance > 0
          );
          setAvailablePasses(passes);
        } else {
          setLoyaltyMember(null);
          setAvailablePasses([]);
        }
      } catch { setLoyaltyMember(null); }
      finally  { setLookingUp(false); }
    }, 700);
    return () => { clearTimeout(timer); setLookingUp(false); };
  }, [phone]);

  // Pre-validate all passes against current cart items
  useEffect(() => {
    if (!availablePasses.length || !pending?.lines?.length) return;
    const results: Record<string, PassEligibility> = {};
    Promise.all(
      availablePasses.map(async pass => {
        if (!pass.code) { results[pass.id] = { ok: false, reason: 'No pass code' }; return; }
        try {
          const res = await fetch('/api/passes/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: pass.code, items: pending.lines }),
          });
          const d = await res.json();
          results[pass.id] = d.valid
            ? { ok: true, reason: '' }
            : { ok: false, reason: d.reason ?? 'Cannot be applied' };
        } catch {
          results[pass.id] = { ok: true, reason: '' }; // fail open — let Apply sort it out
        }
      })
    ).then(() => setPassEligibility({ ...results }));
  }, [availablePasses, pending?.lines]);

  const applyPass = async (pass: PassOption) => {
    if (!pass.code || !pending) return;
    setPassStatus('checking');
    setPassMsg('');
    try {
      const res = await fetch('/api/passes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pass.code, items: pending.lines }),
      });
      const d = await res.json();
      if (d.valid) {
        setSelectedPass(pass);
        setPassStatus('valid');
        setPassDiscount(d.discount_amount);
        setPassUsesApplied(d.uses_applied);
        setPassMsg(`${d.uses_applied} use${d.uses_applied !== 1 ? 's' : ''} applied — RM ${Number(d.discount_amount).toFixed(2)} off`);
      } else {
        setPassStatus('invalid');
        setPassMsg(d.reason ?? 'Pass could not be applied');
        setSelectedPass(null);
      }
    } catch {
      setPassStatus('invalid');
      setPassMsg('Could not validate pass. Try again.');
      setSelectedPass(null);
    }
  };

  const removePass = () => {
    setSelectedPass(null);
    setPassStatus('idle');
    setPassMsg('');
    setPassDiscount(0);
    setPassUsesApplied(0);
  };

  const discountedTotal = (() => {
    let base = pending?.total ?? 0;
    if (voucherStatus === 'valid' && pending) {
      base = voucherType === 'percent'
        ? Math.max(0, base * (1 - voucherDiscount / 100))
        : Math.max(0, base - voucherDiscount);
    }
    if (passStatus === 'valid') base = Math.max(0, base - passDiscount);
    return base;
  })();

  const pointsToEarn = (() => {
    if (!loyaltyConfig || loyaltyConfig.trigger_type !== 'purchase') return 0;
    if (loyaltyConfig.points_per_rm) return Math.floor(discountedTotal * loyaltyConfig.points_per_rm);
    return loyaltyConfig.points_per_trigger ?? 0;
  })();
  const currentProgramPoints = loyaltyMember?.programPoints ?? 0;
  const willUnlockVoucher = pointsToEarn > 0 && !!loyaltyConfig &&
    currentProgramPoints < loyaltyConfig.threshold &&
    (currentProgramPoints + pointsToEarn) >= loyaltyConfig.threshold;

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
        const amt = Number(d.voucher.discount_amount);
        setVoucherStatus('valid');
        setVoucherDiscount(amt);
        setVoucherType(d.voucher.type);
        setVoucherMsg(
          d.voucher.type === 'percent'
            ? `${amt}% off applied`
            : `RM ${amt.toFixed(2)} off applied`,
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

  // Pass QR overlay (shown anywhere on the checkout page)
  const PassQROverlay = passQrPass && passQrPass.code ? (
    <div
      onClick={() => setPassQrPass(null)}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: BG, borderRadius: R, padding: '28px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 320, width: '100%', border: `3px solid ${INK}` }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 20, color: INK }}>{passQrPass.loyalty_programs?.name ?? 'Pass'}</div>
          <div style={{ fontFamily: "'Nunito', system-ui", fontSize: 13, color: hex(INK, .55), marginTop: 3 }}>
            {passQrPass.points_balance} use{passQrPass.points_balance !== 1 ? 's' : ''} remaining
          </div>
        </div>
        <div style={{ background: '#fff', padding: 16, borderRadius: 14, border: `2px solid ${hex(INK, .12)}` }}>
          <QRCodeSVG value={passQrPass.code} size={180} fgColor={INK} bgColor="#ffffff" level="M" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Nunito', system-ui", fontSize: 11, fontWeight: 700, color: hex(INK, .4), textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Pass code</div>
          <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 16, color: INK, letterSpacing: '.06em' }}>{passQrPass.code}</div>
        </div>
        <div style={{ fontFamily: "'Nunito', system-ui", fontSize: 12, color: hex(INK, .45), textAlign: 'center' }}>Show to the cashier at pickup to redeem</div>
        <button onClick={() => setPassQrPass(null)} style={{ background: INK, color: '#fff', border: 'none', borderRadius: 999, padding: '10px 32px', fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  ) : null;

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
    if (!isValidMalaysianPhone(normalisePhone(phone))) { setError('Enter a valid Malaysian phone number (e.g. 0123456789).'); return; }
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
          pickup,
          items: pending.lines,
          total: discountedTotal,
          channel,
          ...(voucherStatus === 'valid' && voucherCode ? { voucher_code: voucherCode.trim().toUpperCase() } : {}),
          ...(passStatus === 'valid' && selectedPass?.code ? { pass_code: selectedPass.code } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Checkout failed.'); setLoading(false); return; }
      localStorage.setItem('co_session', data.sessionId);
      try { localStorage.setItem('co_last_order', JSON.stringify({ items: pending.lines, when: 'Last order' })); } catch { /* ignore */ }

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
      {PassQROverlay}
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
          <button
            type="button"
            onClick={() => setPickup(p => p === 'curbside' ? 'counter' : 'curbside')}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, background: '#FFF6E8', border: `2px solid ${PRI}`, borderRadius: R - 10, padding: '10px 14px', cursor: 'pointer' }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: hex(INK, .45), textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>Pickup location</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: INK, fontFamily: "'Baloo 2', system-ui" }}>
                {pickup === 'curbside' ? '🚗 Curbside pickup' : '🚶 Counter pickup'}
              </div>
            </div>
            <div style={{ fontSize: 12, color: PRI, fontWeight: 700, fontFamily: "'Nunito', system-ui", whiteSpace: 'nowrap' }}>change →</div>
          </button>
          {voucherStatus === 'valid' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16A34A', marginBottom: 4 }}>
              <span>Voucher ({voucherCode.toUpperCase()})</span>
              <span>
                -{voucherType === 'percent'
                  ? `${voucherDiscount}% (RM ${(voucherType === 'percent' ? pending.total * voucherDiscount / 100 : voucherDiscount).toFixed(2)})`
                  : `RM ${voucherDiscount.toFixed(2)}`}
              </span>
            </div>
          )}
          {passStatus === 'valid' && selectedPass && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16A34A', marginBottom: 4 }}>
              <span>Pass ({selectedPass.loyalty_programs?.name ?? selectedPass.code}) ×{passUsesApplied}</span>
              <span>-RM {passDiscount.toFixed(2)}</span>
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

        {/* Loyalty points preview — only shown once member is identified */}
        {loyaltyMember && pointsToEarn > 0 && loyaltyConfig && (
          <div style={{ background: willUnlockVoucher ? '#F0FDF4' : '#FFFBEB', border: `1.5px solid ${willUnlockVoucher ? '#86EFAC' : '#FDE68A'}`, borderRadius: R - 8, padding: '11px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{willUnlockVoucher ? '🎉' : '⭐'}</span>
            <div style={{ fontFamily: "'Nunito', system-ui", fontSize: 13 }}>
              {willUnlockVoucher ? (
                <>
                  <span style={{ fontWeight: 800, color: '#15803D' }}>You'll earn {pointsToEarn} pts and unlock a </span>
                  <span style={{ fontWeight: 800, color: '#15803D' }}>
                    {loyaltyConfig.voucher_type === 'percent'
                      ? `${loyaltyConfig.voucher_discount_value}% off`
                      : `RM ${Number(loyaltyConfig.voucher_discount_value).toFixed(2)} off`}
                  </span>
                  <span style={{ fontWeight: 800, color: '#15803D' }}> voucher with this order!</span>
                </>
              ) : (
                <>
                  <span style={{ fontWeight: 800, color: '#92400E' }}>+{pointsToEarn} pts</span>
                  <span style={{ color: '#92400E' }}> · {loyaltyConfig.threshold - currentProgramPoints - pointsToEarn} more pts to your next </span>
                  <span style={{ fontWeight: 700, color: '#92400E' }}>
                    {loyaltyConfig.voucher_type === 'percent'
                      ? `${loyaltyConfig.voucher_discount_value}% off`
                      : `RM ${Number(loyaltyConfig.voucher_discount_value).toFixed(2)} off`}
                  </span>
                  <span style={{ color: '#92400E' }}> voucher</span>
                </>
              )}
            </div>
          </div>
        )}

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
              <div style={{ display:'flex', border:'1.5px solid rgba(58,36,20,.12)', borderRadius:10, overflow:'hidden', background:'#FFF6E8' }}>
                <span style={{ padding:'12px 8px 12px 14px', fontSize:15, fontFamily:"'Nunito',system-ui", color:'rgba(58,36,20,.4)', userSelect:'none', flexShrink:0 }}>01</span>
                <input
                  type="tel"
                  value={phone.startsWith('01') ? phone.slice(2) : phone}
                  onChange={e => setPhone('01' + e.target.value.replace(/\D/g, ''))}
                  placeholder="X-XXXXXXXX"
                  maxLength={9}
                  required
                  style={{ ...inputStyle, flex:1, border:'none', borderRadius:0, padding:'12px 14px 12px 0', background:'transparent', outline:'none' }}
                />
              </div>
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
                  placeholder="e.g. VCH-ABC12-XY34"
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
              {voucherStatus !== 'valid' && (
                <a
                  href={`/vouchers?returnTo=checkout&total=${pending?.total?.toFixed(2) ?? '0'}`}
                  style={{ display: 'inline-block', marginTop: 7, fontSize: 13, color: PRI, fontWeight: 700, textDecoration: 'none', fontFamily: "'Nunito', system-ui" }}
                >
                  Browse my vouchers →
                </a>
              )}
            </div>

            {/* Passes — only shown if member has active passes */}
            {availablePasses.length > 0 && (
              <div>
                <label style={labelStyle}>Use a Pass</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {availablePasses.map(pass => {
                    const isSelected  = selectedPass?.id === pass.id;
                    const isApplied   = passStatus === 'valid' && isSelected;
                    const eligibility = passEligibility[pass.id];
                    const canApply    = !eligibility || eligibility.ok; // optimistic until checked
                    const ineligibleReason = eligibility && !eligibility.ok ? eligibility.reason : '';
                    return (
                      <div
                        key={pass.id}
                        style={{
                          background: canApply ? '#fff' : hex(INK, .03),
                          borderRadius: R - 8,
                          border: `1.5px solid ${isApplied ? '#16A34A' : isSelected ? PRI : canApply ? hex(INK, .12) : hex(INK, .07)}`,
                          overflow: 'hidden',
                          opacity: canApply ? 1 : .6,
                        }}
                      >
                        {/* Pass row */}
                        <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: canApply ? '#6B21A8' : hex(INK, .2), display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 16, color: '#fff' }}>🎟</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: INK, fontFamily: "'Baloo 2', system-ui" }}>
                              {pass.loyalty_programs?.name ?? 'Pass'}
                            </div>
                            <div style={{ fontSize: 12, color: hex(INK, .5), fontFamily: "'Nunito', system-ui" }}>
                              {ineligibleReason || `${pass.points_balance} use${pass.points_balance !== 1 ? 's' : ''} remaining`}
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            {pass.code && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => { setCopiedPass(pass.code); navigator.clipboard.writeText(pass.code!).then(() => setTimeout(() => setCopiedPass(null), 2000)); }}
                                  style={{ padding: '6px 10px', borderRadius: 999, border: `1px solid ${hex(INK,.2)}`, background: copiedPass === pass.code ? INK : 'transparent', color: copiedPass === pass.code ? '#fff' : INK, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito', system-ui", transition: 'all .2s' }}
                                >
                                  {copiedPass === pass.code ? '✓' : 'Copy'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPassQrPass(pass)}
                                  style={{ padding: '6px 10px', borderRadius: 999, border: `1px solid ${hex(INK,.2)}`, background: 'transparent', color: INK, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito', system-ui" }}
                                >
                                  QR
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={isApplied ? removePass : () => applyPass(pass)}
                              disabled={!canApply || passStatus === 'checking'}
                              style={{
                                padding: '6px 12px', borderRadius: 999, border: 'none',
                                background: isApplied ? '#16A34A' : canApply ? '#6B21A8' : hex(INK, .15),
                                color: canApply ? '#fff' : hex(INK, .4),
                                fontSize: 12, fontWeight: 700,
                                cursor: (!canApply || passStatus === 'checking') ? 'not-allowed' : 'pointer',
                                fontFamily: "'Nunito', system-ui",
                                opacity: passStatus === 'checking' && isSelected ? .6 : 1,
                              }}
                            >
                              {isApplied ? '✓ Remove' : passStatus === 'checking' && isSelected ? '…' : 'Apply'}
                            </button>
                          </div>
                        </div>
                        {/* Status message for this pass (after clicking Apply) */}
                        {(isSelected && passMsg) && (
                          <div style={{ padding: '6px 14px 10px', fontSize: 12, fontWeight: 600, color: passStatus === 'valid' ? '#16A34A' : '#C0392B', fontFamily: "'Nunito', system-ui" }}>
                            {passMsg}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

const INK = '#3A2414';
const PRI = '#F58220';
const BG  = '#EFE4D1';
const R   = 22;

function hex(h: string, a = 1) {
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function fmtExpiry(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur',
  });
}

interface Pass {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  voucher_type: 'fixed' | 'percent';
  voucher_value: number;
}

interface ClaimedVoucher {
  code:       string;
  type:       'fixed' | 'percent';
  value:      number;
  expires_at: string;
}

function ScanPassContent() {
  const params = useParams();
  const router = useRouter();
  const slug   = (params?.slug as string) ?? '';

  const [pass,    setPass]    = useState<Pass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [phone,     setPhone]     = useState('');
  const [claiming,  setClaiming]  = useState(false);
  const [claimErr,  setClaimErr]  = useState('');
  const [voucher,   setVoucher]   = useState<ClaimedVoucher | null>(null);
  const [wasClaimed, setWasClaimed] = useState(false); // already had it today
  const [showQR,    setShowQR]    = useState(false);
  const [copied,    setCopied]    = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/scanpass/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setPass(d.pass);
      })
      .catch(() => setError('Could not load offer. Please try again.'))
      .finally(() => setLoading(false));

    // Pre-fill phone if saved
    try {
      const saved = JSON.parse(localStorage.getItem('co_form') ?? '{}');
      if (saved.phone) setPhone(saved.phone);
    } catch { /* ignore */ }
  }, [slug]);

  const claim = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) { setClaimErr('Please enter a valid phone number'); return; }
    setClaimErr('');
    setClaiming(true);
    try {
      const res = await fetch('/api/scanpass/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, phone: digits }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { setClaimErr(d.error ?? 'Something went wrong'); return; }
      setVoucher(d.voucher);
      setWasClaimed(d.already_claimed ?? false);
      // Save phone for future use
      try {
        const existing = JSON.parse(localStorage.getItem('co_form') ?? '{}');
        localStorage.setItem('co_form', JSON.stringify({ ...existing, phone: digits }));
      } catch { /* ignore */ }
    } catch { setClaimErr('Network error. Please try again.'); }
    finally { setClaiming(false); }
  };

  const copyCode = () => {
    if (!voucher) return;
    navigator.clipboard.writeText(voucher.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const s: React.CSSProperties       = { fontFamily: "'Nunito', system-ui" };
  const heading: React.CSSProperties = { fontFamily: "'Baloo 2', system-ui", fontWeight: 800, color: INK };

  if (loading) return (
    <div style={{ minHeight:'100vh', background:BG, display:'grid', placeItems:'center' }}>
      <div style={{ ...s, color:hex(INK,.45), fontSize:15 }}>Loading offer…</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight:'100vh', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ fontSize:48, marginBottom:16 }}>☕</div>
      <div style={{ ...heading, fontSize:20, marginBottom:8, textAlign:'center' }}>Offer unavailable</div>
      <div style={{ ...s, fontSize:14, color:hex(INK,.6), textAlign:'center', marginBottom:24 }}>{error}</div>
      <button onClick={() => router.push('/')} style={{ background:PRI, color:'#fff', border:'none', borderRadius:999, padding:'12px 28px', ...s, fontWeight:700, fontSize:15, cursor:'pointer' }}>
        View menu
      </button>
    </div>
  );

  if (!pass) return null;

  const discountLabel = pass.voucher_type === 'percent'
    ? `${pass.voucher_value}% off`
    : `RM ${Number(pass.voucher_value).toFixed(2)} off`;

  // ── Voucher claimed — success screen ────────────────────────────────────
  if (voucher) {
    const vLabel = voucher.type === 'percent'
      ? `${voucher.value}% off`
      : `RM ${Number(voucher.value).toFixed(2)} off`;

    return (
      <div style={{ minHeight:'100vh', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 16px' }}>
        {/* QR overlay */}
        {showQR && (
          <div
            onClick={() => setShowQR(false)}
            style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,.85)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}
          >
            <div onClick={e => e.stopPropagation()} style={{ background:'#FFF6E8', borderRadius:R, padding:'28px 24px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:16, maxWidth:320, width:'100%', border:`3px solid ${INK}` }}>
              <div style={{ ...heading, fontSize:20, textAlign:'center' }}>{vLabel}</div>
              <div style={{ background:'#fff', padding:16, borderRadius:14, border:`2px solid ${hex(INK,.12)}` }}>
                <QRCodeSVG value={voucher.code} size={200} fgColor={INK} bgColor="#ffffff" level="M" />
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ ...s, fontSize:11, fontWeight:700, color:hex(INK,.4), textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Voucher code</div>
                <div style={{ ...heading, fontSize:18, letterSpacing:'.06em' }}>{voucher.code}</div>
                <div style={{ ...s, fontSize:12, color:hex(INK,.45), marginTop:4 }}>Expires today at {fmtExpiry(voucher.expires_at)}</div>
              </div>
              <div style={{ ...s, fontSize:12, color:hex(INK,.45), textAlign:'center' }}>Show to cashier or use code at online checkout</div>
              <button onClick={() => setShowQR(false)} style={{ background:INK, color:'#fff', border:'none', borderRadius:999, padding:'10px 32px', ...heading, fontSize:14, cursor:'pointer' }}>Close</button>
            </div>
          </div>
        )}

        <div style={{ width:'100%', maxWidth:420 }}>
          {/* Hero */}
          <div style={{ background:INK, borderRadius:R, padding:'28px 24px 24px', marginBottom:16, textAlign:'center' }}>
            <div style={{ fontSize:52, marginBottom:12 }}>🎉</div>
            <div style={{ ...heading, fontSize:24, color:'#fff', marginBottom:6 }}>
              {wasClaimed ? 'Your voucher' : "You're all set!"}
            </div>
            <div style={{ ...s, fontSize:14, color:'rgba(255,255,255,.7)' }}>
              {wasClaimed
                ? "You already claimed this today — here it is again."
                : `${discountLabel} voucher added to your account`}
            </div>
          </div>

          {/* Voucher card */}
          <div style={{ background:'#fff', borderRadius:R-2, overflow:'hidden', border:`2px solid ${PRI}`, marginBottom:14 }}>
            <div style={{ background:PRI, padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:46, height:46, borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'grid', placeItems:'center', fontSize:24, flexShrink:0 }}>☕</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ ...heading, fontSize:20, color:'#fff' }}>{vLabel}</div>
                <div style={{ ...s, fontSize:12, color:'rgba(255,255,255,.8)', marginTop:1 }}>
                  Valid today until {fmtExpiry(voucher.expires_at)}
                </div>
              </div>
            </div>
            <div style={{ padding:'14px 18px' }}>
              <div style={{ ...s, fontSize:11, fontWeight:700, color:hex(INK,.4), textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>Voucher code</div>
              <div style={{ ...heading, fontSize:18, letterSpacing:'.05em', marginBottom:14 }}>{voucher.code}</div>

              <div style={{ display:'flex', gap:8 }}>
                <button
                  onClick={() => setShowQR(true)}
                  style={{ flex:1, padding:'11px', background:INK, color:'#fff', border:'none', borderRadius:R-8, ...s, fontWeight:700, fontSize:14, cursor:'pointer' }}
                >
                  Show QR →
                </button>
                <button
                  onClick={copyCode}
                  style={{
                    padding:'11px 18px', border:`1.5px solid ${INK}`, borderRadius:R-8,
                    background: copied ? INK : 'transparent', color: copied ? '#fff' : INK,
                    ...s, fontWeight:700, fontSize:14, cursor:'pointer', flexShrink:0, transition:'all .2s',
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Use at checkout CTA */}
          <a
            href={`/checkout?voucher=${encodeURIComponent(voucher.code)}`}
            style={{
              display:'block', width:'100%', padding:'14px',
              background:PRI, color:'#fff', border:'none', borderRadius:R,
              ...heading, fontSize:16, cursor:'pointer', textAlign:'center', textDecoration:'none',
              boxShadow:`0 6px 0 ${hex(PRI,.4)}`,
            }}
          >
            Order online now →
          </a>
          <button
            onClick={() => router.push('/')}
            style={{ marginTop:12, width:'100%', padding:'12px', background:'transparent', border:`1.5px solid ${hex(INK,.2)}`, borderRadius:R, ...s, fontWeight:700, fontSize:14, color:hex(INK,.6), cursor:'pointer' }}
          >
            Browse menu
          </button>
        </div>
      </div>
    );
  }

  // ── Claim form ───────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 16px' }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        {/* Hero image or coloured banner */}
        <div style={{
          borderRadius:R, overflow:'hidden', marginBottom:18,
          background: pass.image_url ? '#000' : INK,
          minHeight: pass.image_url ? 0 : 180,
          position:'relative',
        }}>
          {pass.image_url && (
            <img src={pass.image_url} alt={pass.name} style={{ width:'100%', maxHeight:260, objectFit:'cover', display:'block', opacity:.85 }} />
          )}
          <div style={{
            position: pass.image_url ? 'absolute' : 'relative',
            bottom:0, left:0, right:0,
            padding:'24px',
            background: pass.image_url ? 'linear-gradient(to top, rgba(0,0,0,.8) 0%, transparent 100%)' : 'transparent',
          }}>
            <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:26, color:'#fff', lineHeight:1.1, marginBottom:6 }}>
              {pass.name}
            </div>
            {pass.description && (
              <div style={{ ...s, fontSize:14, color:'rgba(255,255,255,.8)', lineHeight:1.5 }}>
                {pass.description}
              </div>
            )}
          </div>
        </div>

        {/* What you get */}
        <div style={{ background:'#fff', borderRadius:R-2, padding:'16px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:14, border:`2px solid ${PRI}` }}>
          <div style={{ width:50, height:50, borderRadius:'50%', background:PRI, display:'grid', placeItems:'center', flexShrink:0, fontSize:24 }}>☕</div>
          <div>
            <div style={{ ...heading, fontSize:18 }}>Get {discountLabel} today</div>
            <div style={{ ...s, fontSize:13, color:hex(INK,.6), marginTop:2 }}>
              Enter your phone and claim your voucher — valid until midnight tonight
            </div>
          </div>
        </div>

        {/* Phone form */}
        <form onSubmit={claim} style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <input
            type="tel"
            value={phone}
            onChange={e => { setPhone(e.target.value); setClaimErr(''); }}
            placeholder="Your phone number (e.g. 0123456789)"
            style={{
              width:'100%', padding:'16px', fontSize:16, color:INK,
              background:'#fff', border:`1.5px solid ${hex(INK,.15)}`,
              borderRadius:R-8, outline:'none',
              fontFamily:"'Nunito', system-ui",
            }}
          />
          {claimErr && (
            <div style={{ ...s, fontSize:13, color:'#C0392B', fontWeight:600 }}>{claimErr}</div>
          )}
          <button
            type="submit"
            disabled={claiming}
            style={{
              padding:'15px', background: claiming ? hex(PRI,.6) : PRI,
              color:'#fff', border:'none', borderRadius:R,
              ...heading, fontSize:16, cursor: claiming ? 'not-allowed' : 'pointer',
              boxShadow: claiming ? 'none' : `0 6px 0 ${hex(PRI,.4)}`,
            }}
          >
            {claiming ? 'Claiming…' : `Claim ${discountLabel} voucher →`}
          </button>
        </form>

        <div style={{ ...s, fontSize:12, color:hex(INK,.4), textAlign:'center', marginTop:14, lineHeight:1.6 }}>
          One voucher per phone number per day.<br />
          Redeemable online or at the counter.
        </div>
      </div>
    </div>
  );
}

export default function ScanPassPage() {
  return (
    <Suspense>
      <ScanPassContent />
    </Suspense>
  );
}

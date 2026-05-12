'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Voucher } from '@/lib/types';

const INK = '#3A2414';
const PRI = '#F58220';
const BG  = '#FFF6E8';
const R   = 22;

function hex(h: string, a = 1) {
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function VouchersContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const returnTo     = searchParams.get('returnTo'); // 'checkout'
  const orderTotal   = parseFloat(searchParams.get('total') ?? '0');

  const [phone,    setPhone]    = useState('');
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [copied,   setCopied]   = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('co_form') ?? '{}');
      const p = (saved.phone ?? '').replace(/\D/g, '');
      setPhone(p);
      if (p.length >= 8) {
        fetch(`/api/loyalty/member?phone=${p}`)
          .then(r => r.json())
          .then(d => setVouchers(d.vouchers ?? []))
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const applyAtCheckout = (code: string) => {
    setApplying(code);
    router.push(`/checkout?voucher=${encodeURIComponent(code)}`);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discountAmt = (v: any) => Number(v.discount_amount ?? v.amount ?? 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isEligible = (v: any) => {
    const min = v.min_order != null ? Number(v.min_order) : null;
    return min == null || orderTotal <= 0 || orderTotal >= min;
  };

  const s: React.CSSProperties = { fontFamily: "'Nunito', system-ui" };
  const heading: React.CSSProperties = { fontFamily: "'Baloo 2', system-ui", fontWeight: 800, color: INK };

  return (
    <div style={{ minHeight: '100vh', background: '#EFE4D1', padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ background: INK, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '4px 8px 4px 0' }}
        >
          ←
        </button>
        <div style={{ ...heading, fontSize: 18, color: '#fff' }}>My Vouchers</div>
        {returnTo === 'checkout' && (
          <div style={{ marginLeft: 'auto', ...s, fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
            Tap a voucher to apply
          </div>
        )}
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>
        {loading ? (
          <div style={{ ...s, textAlign: 'center', color: hex(INK, .45), padding: '40px 0' }}>Loading your vouchers…</div>
        ) : !phone ? (
          <div style={{ background: BG, borderRadius: R, padding: 24, textAlign: 'center', border: `2px solid ${hex(INK, .1)}` }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎟️</div>
            <div style={{ ...heading, fontSize: 18, marginBottom: 6 }}>No account linked</div>
            <div style={{ ...s, fontSize: 14, color: hex(INK, .6), marginBottom: 16 }}>
              Complete a purchase first — your vouchers appear here automatically.
            </div>
            <button
              onClick={() => router.back()}
              style={{ background: PRI, color: '#fff', border: 'none', borderRadius: 999, padding: '10px 24px', ...s, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              Go back
            </button>
          </div>
        ) : vouchers.length === 0 ? (
          <div style={{ background: BG, borderRadius: R, padding: 24, textAlign: 'center', border: `2px solid ${hex(INK, .1)}` }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎟️</div>
            <div style={{ ...heading, fontSize: 18, marginBottom: 6 }}>No vouchers yet</div>
            <div style={{ ...s, fontSize: 14, color: hex(INK, .6), marginBottom: 16 }}>
              Keep earning stamps and points — vouchers appear here when you hit a reward.
            </div>
            <button
              onClick={() => router.back()}
              style={{ background: PRI, color: '#fff', border: 'none', borderRadius: 999, padding: '10px 24px', ...s, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              Go back
            </button>
          </div>
        ) : (
          <>
            {returnTo === 'checkout' && orderTotal > 0 && (
              <div style={{ background: hex(PRI, .12), border: `1.5px solid ${hex(PRI, .3)}`, borderRadius: R - 6, padding: '10px 14px', marginBottom: 16, ...s, fontSize: 13, color: INK }}>
                <strong>Order total: RM {orderTotal.toFixed(2)}</strong>
                {vouchers.some(v => !isEligible(v)) && ' · Some vouchers require a higher order total'}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {vouchers.map(v => {
                const eligible = isEligible(v);
                const amt = discountAmt(v);
                return (
                  <div key={v.id} style={{
                    background: '#fff', borderRadius: R - 2,
                    border: `2px solid ${eligible ? PRI : hex(INK, .1)}`,
                    overflow: 'hidden',
                    opacity: eligible ? 1 : 0.6,
                  }}>
                    {/* Voucher header strip */}
                    <div style={{ background: eligible ? PRI : hex(INK, .08), padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: eligible ? '#fff' : hex(INK, .15), display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <span style={{ ...heading, fontSize: 15, color: eligible ? PRI : hex(INK, .5), lineHeight: 1 }}>
                          {v.type === 'percent' ? `${amt}%` : `RM${amt.toFixed(2)}`}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...heading, fontSize: 18, color: eligible ? '#fff' : INK }}>
                          {v.type === 'percent'
                            ? `${amt}% off`
                            : `RM ${amt.toFixed(2)} off`}
                        </div>
                        {v.min_order != null && (
                          <div style={{ ...s, fontSize: 12, color: eligible ? 'rgba(255,255,255,.75)' : hex(INK, .5) }}>
                            Min. order RM {Number(v.min_order).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Voucher body */}
                    <div style={{ padding: '12px 16px' }}>
                      {/* Dashed divider */}
                      <div style={{ borderTop: `2px dashed ${hex(INK, .1)}`, marginBottom: 12 }} />

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ ...s, fontSize: 11, fontWeight: 700, color: hex(INK, .4), textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Code</div>
                          <div style={{ ...heading, fontSize: 16, letterSpacing: '.05em' }}>{v.code}</div>
                          {v.expires_at && (
                            <div style={{ ...s, fontSize: 12, color: hex(INK, .45), marginTop: 2 }}>
                              Expires {new Date(v.expires_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          )}
                        </div>

                        {returnTo === 'checkout' ? (
                          <button
                            disabled={!eligible || applying === v.code}
                            onClick={() => applyAtCheckout(v.code)}
                            style={{
                              background: eligible ? PRI : hex(INK, .08),
                              color: eligible ? '#fff' : hex(INK, .35),
                              border: 'none', borderRadius: 999,
                              padding: '10px 20px', cursor: eligible ? 'pointer' : 'not-allowed',
                              ...s, fontWeight: 700, fontSize: 14, flexShrink: 0,
                              opacity: applying === v.code ? .6 : 1,
                            }}
                          >
                            {applying === v.code ? '…' : eligible ? 'Apply →' : 'Not eligible'}
                          </button>
                        ) : (
                          <button
                            onClick={() => copyCode(v.code)}
                            style={{
                              background: copied === v.code ? PRI : 'transparent',
                              color: copied === v.code ? '#fff' : PRI,
                              border: `1.5px solid ${PRI}`, borderRadius: 999,
                              padding: '10px 20px', cursor: 'pointer',
                              ...s, fontWeight: 700, fontSize: 14, flexShrink: 0,
                              transition: 'all .2s',
                            }}
                          >
                            {copied === v.code ? '✓ Copied' : 'Copy code'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {returnTo !== 'checkout' && (
              <div style={{ marginTop: 20, textAlign: 'center', ...s, fontSize: 13, color: hex(INK, .5) }}>
                Copy a code, then paste it at checkout to apply your discount.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function VouchersPage() {
  return (
    <Suspense>
      <VouchersContent />
    </Suspense>
  );
}

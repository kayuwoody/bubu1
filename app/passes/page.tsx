'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

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

interface ProgInfo {
  id: string;
  name: string;
  trigger_type: string;
  threshold: number;
  voucher_type: string;
  voucher_discount_value: number;
  pass_daily_limit: number | null;
}

interface Pass {
  id: string;
  code: string | null;
  points_balance: number;
  total_earned: number;
  enrolled_at: string;
  updated_at: string;
  loyalty_programs: ProgInfo | null;
}

interface PassProduct {
  product_id: string;
  product_name: string | null;
}

interface PassUsage {
  id: string;
  used_at: string;
  // other columns may vary — we display what we have
  [key: string]: unknown;
}

function QROverlay({ pass, onClose }: { pass: Pass; onClose: () => void }) {
  const prog = pass.loyalty_programs;
  const usesLeft = pass.points_balance;
  if (!pass.code) return null;
  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,.85)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background:BG, borderRadius:R, padding:'28px 24px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:16, maxWidth:320, width:'100%', border:`3px solid ${INK}` }}
      >
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:22, color:INK, lineHeight:1.1 }}>
            {prog?.name ?? 'Pass'}
          </div>
          <div style={{ fontFamily:"'Nunito',system-ui", fontSize:13, color:hex(INK,.55), marginTop:3 }}>
            {usesLeft} use{usesLeft !== 1 ? 's' : ''} remaining
          </div>
        </div>
        <div style={{ background:'#fff', padding:16, borderRadius:14, border:`2px solid ${hex(INK,.12)}` }}>
          <QRCodeSVG value={pass.code} size={200} fgColor={INK} bgColor="#ffffff" level="M" />
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:"'Nunito',system-ui", fontSize:11, fontWeight:700, color:hex(INK,.4), textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>
            Pass code
          </div>
          <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:16, color:INK, letterSpacing:'.06em' }}>
            {pass.code}
          </div>
        </div>
        <div style={{ fontFamily:"'Nunito',system-ui", fontSize:12, color:hex(INK,.45), textAlign:'center' }}>
          Show this to the cashier to redeem your pass
        </div>
        <button
          onClick={onClose}
          style={{ background:INK, color:'#fff', border:'none', borderRadius:999, padding:'10px 32px', fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:14, cursor:'pointer' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function PassesContent() {
  const router = useRouter();
  const [phone,    setPhone]    = useState('');
  const [passes,   setPasses]   = useState<Pass[]>([]);
  const [products, setProducts] = useState<Record<string, PassProduct[]>>({});
  const [usage,    setUsage]    = useState<Record<string, PassUsage[]>>({});
  const [loading,  setLoading]  = useState(true);
  const [qrPass,   setQrPass]   = useState<Pass | null>(null);
  const [copied,   setCopied]   = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('co_form') ?? '{}');
      const p = (saved.phone ?? '').replace(/\D/g, '');
      setPhone(p);
      if (p.length >= 8) {
        fetch(`/api/loyalty/member?phone=${p}`)
          .then(r => r.json())
          .then(d => {
            const passList: Pass[] = (d.programBalances ?? []).filter(
              (pb: Pass) => pb.loyalty_programs?.trigger_type === 'pass'
            );
            setPasses(passList);

            const programIds = [...new Set(passList.map(pb => pb.loyalty_programs?.id).filter(Boolean))] as string[];
            const enrollmentIds = passList.map(pb => pb.id);

            return Promise.all([
              // Eligible products per program
              programIds.length > 0
                ? Promise.all(programIds.map(pid =>
                    fetch(`/api/loyalty/pass-products?program_id=${pid}`)
                      .then(r => r.json()).then(data => ({ pid, items: data.products ?? [] })).catch(() => ({ pid, items: [] }))
                  )).then(results => {
                    const map: Record<string, PassProduct[]> = {};
                    for (const { pid, items } of results) map[pid] = items;
                    setProducts(map);
                  })
                : Promise.resolve(),
              // Usage log per enrollment
              enrollmentIds.length > 0
                ? Promise.all(enrollmentIds.map(eid =>
                    fetch(`/api/loyalty/pass-usage?enrollment_id=${eid}`)
                      .then(r => r.json()).then(data => ({ eid, items: data.usage ?? [] })).catch(() => ({ eid, items: [] }))
                  )).then(results => {
                    const map: Record<string, PassUsage[]> = {};
                    for (const { eid, items } of results) map[eid] = items;
                    setUsage(map);
                  })
                : Promise.resolve(),
            ]);
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  const s: React.CSSProperties    = { fontFamily: "'Nunito', system-ui" };
  const heading: React.CSSProperties = { fontFamily: "'Baloo 2', system-ui", fontWeight: 800, color: INK };

  return (
    <div style={{ minHeight:'100vh', background:'#EFE4D1', paddingBottom:40 }}>
      {qrPass && <QROverlay pass={qrPass} onClose={() => setQrPass(null)} />}

      {/* Header */}
      <div style={{ background:INK, padding:'16px 20px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:10 }}>
        <button
          onClick={() => router.back()}
          style={{ background:'transparent', border:'none', color:'#fff', fontSize:22, cursor:'pointer', lineHeight:1, padding:'4px 8px 4px 0' }}
        >
          ←
        </button>
        <div style={{ ...heading, fontSize:18, color:'#fff' }}>My Passes</div>
      </div>

      <div style={{ maxWidth:480, margin:'0 auto', padding:'20px 16px' }}>
        {loading ? (
          <div style={{ ...s, textAlign:'center', color:hex(INK,.45), padding:'40px 0' }}>Loading passes…</div>
        ) : !phone ? (
          <div style={{ background:BG, borderRadius:R, padding:24, textAlign:'center', border:`2px solid ${hex(INK,.1)}` }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🎟️</div>
            <div style={{ ...heading, fontSize:18, marginBottom:6 }}>No account linked</div>
            <div style={{ ...s, fontSize:14, color:hex(INK,.6), marginBottom:16 }}>
              Complete a purchase first — your passes will appear here.
            </div>
            <button onClick={() => router.back()} style={{ background:PRI, color:'#fff', border:'none', borderRadius:999, padding:'10px 24px', ...s, fontWeight:700, fontSize:14, cursor:'pointer' }}>
              Go back
            </button>
          </div>
        ) : passes.length === 0 ? (
          <div style={{ background:BG, borderRadius:R, padding:24, textAlign:'center', border:`2px solid ${hex(INK,.1)}` }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🎟️</div>
            <div style={{ ...heading, fontSize:18, marginBottom:6 }}>No passes yet</div>
            <div style={{ ...s, fontSize:14, color:hex(INK,.6), marginBottom:16 }}>
              Visit the shop to purchase a pass and see it here.
            </div>
            <button onClick={() => router.back()} style={{ background:PRI, color:'#fff', border:'none', borderRadius:999, padding:'10px 24px', ...s, fontWeight:700, fontSize:14, cursor:'pointer' }}>
              Go back
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {passes.map(pass => {
              const prog = pass.loyalty_programs;
              const usesLeft = pass.points_balance;
              const totalUses = pass.total_earned > 0 ? pass.total_earned : (usesLeft + 1);
              const usesSpent = Math.max(0, totalUses - usesLeft);
              const pct = Math.min(100, Math.round((usesSpent / totalUses) * 100));
              const eligibleProducts = prog ? (products[prog.id] ?? []) : [];
              const passUsage = usage[pass.id] ?? [];
              const dailyLimit = prog?.pass_daily_limit ?? null;

              // Count today's uses from usage log
              const todayStr = new Date().toISOString().slice(0, 10);
              const todayUsed = passUsage.filter(u => u.used_at?.toString().slice(0, 10) === todayStr).length;
              const todayRemaining = dailyLimit !== null ? Math.max(0, dailyLimit - todayUsed) : null;
              const dailyLimitReached = todayRemaining !== null && todayRemaining === 0;

              return (
                <div key={pass.id} style={{ background:'#fff', borderRadius:R-2, overflow:'hidden', border:`1.5px solid ${hex(INK,.08)}` }}>
                  {/* Pass header */}
                  <div style={{ background: dailyLimitReached ? '#4B5563' : '#6B21A8', padding:'16px 18px', transition:'background .3s' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ width:48, height:48, borderRadius:'50%', background:'rgba(255,255,255,.15)', display:'grid', placeItems:'center', flexShrink:0, fontSize:24 }}>
                        🎟
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:18, color:'#fff', lineHeight:1.1 }}>
                          {prog?.name ?? 'Pass'}
                        </div>
                        {pass.code && (
                          <div style={{ fontFamily:"'Nunito',system-ui", fontSize:12, color:'rgba(255,255,255,.7)', marginTop:2, letterSpacing:'.04em' }}>
                            {pass.code}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:800, fontSize:28, color:'#fff', lineHeight:1 }}>
                          {usesLeft}
                        </div>
                        <div style={{ fontFamily:"'Nunito',system-ui", fontSize:11, color:'rgba(255,255,255,.65)' }}>
                          use{usesLeft !== 1 ? 's' : ''} left
                        </div>
                      </div>
                    </div>

                    {/* Overall progress bar */}
                    <div style={{ marginTop:12 }}>
                      <div style={{ height:5, background:'rgba(255,255,255,.2)', borderRadius:999, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:'#fff', borderRadius:999, transition:'width .4s ease' }} />
                      </div>
                      <div style={{ fontFamily:"'Nunito',system-ui", fontSize:11, color:'rgba(255,255,255,.6)', marginTop:4 }}>
                        {usesSpent} of {totalUses} uses spent
                      </div>
                    </div>

                    {/* Daily limit indicator */}
                    {dailyLimit !== null && (
                      <div style={{ marginTop:10, background:'rgba(0,0,0,.2)', borderRadius:10, padding:'8px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ fontFamily:"'Nunito',system-ui", fontSize:12, color:'rgba(255,255,255,.85)' }}>
                          {dailyLimitReached
                            ? `Daily limit reached — resets tomorrow`
                            : `Today: ${todayUsed} of ${dailyLimit} use${dailyLimit !== 1 ? 's' : ''} used`}
                        </div>
                        {/* Today's mini progress dots */}
                        <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                          {Array.from({ length: dailyLimit }).map((_, i) => (
                            <div key={i} style={{ width:8, height:8, borderRadius:'50%', background: i < todayUsed ? '#fff' : 'rgba(255,255,255,.3)' }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pass body */}
                  <div style={{ padding:'14px 18px 18px' }}>
                    {/* Daily limit reached warning */}
                    {dailyLimitReached && (
                      <div style={{ background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:R-10, padding:'10px 14px', marginBottom:14 }}>
                        <div style={{ fontFamily:"'Baloo 2',system-ui", fontWeight:700, fontSize:13, color:'#92400E', marginBottom:2 }}>
                          Daily limit reached
                        </div>
                        <div style={{ fontFamily:"'Nunito',system-ui", fontSize:12, color:'#92400E' }}>
                          You&apos;ve used your {dailyLimit} allowed use{dailyLimit !== 1 ? 's' : ''} for today. This pass resets at midnight — use another payment method in the meantime.
                        </div>
                      </div>
                    )}

                    {/* QR + Copy buttons */}
                    {pass.code && (
                      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                        <button
                          onClick={() => setQrPass(pass)}
                          style={{ flex:1, padding:'11px', background:INK, color:'#fff', border:'none', borderRadius:R-8, ...s, fontWeight:700, fontSize:14, cursor:'pointer' }}
                        >
                          Show QR →
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(pass.code!).then(() => {
                              setCopied(pass.code);
                              setTimeout(() => setCopied(null), 2000);
                            });
                          }}
                          style={{
                            padding:'11px 18px', border:`1.5px solid ${INK}`, borderRadius:R-8,
                            background: copied === pass.code ? INK : 'transparent',
                            color: copied === pass.code ? '#fff' : INK,
                            ...s, fontWeight:700, fontSize:14, cursor:'pointer', flexShrink:0,
                            transition:'all .2s',
                          }}
                        >
                          {copied === pass.code ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                    )}

                    {/* Eligible products */}
                    {eligibleProducts.length > 0 && (
                      <div style={{ marginBottom:14 }}>
                        <div style={{ ...s, fontSize:11, fontWeight:700, color:hex(INK,.4), textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                          Valid for
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                          {eligibleProducts.map(p => (
                            <span key={p.product_id} style={{ ...s, fontSize:12, background:hex(INK,.06), color:INK, borderRadius:999, padding:'4px 10px', fontWeight:600 }}>
                              {p.product_name ?? p.product_id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Usage log */}
                    {passUsage.length > 0 && (
                      <div>
                        <div style={{ ...s, fontSize:11, fontWeight:700, color:hex(INK,.4), textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                          Usage history
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {passUsage.slice(0, 10).map((u, i) => {
                            const usedDate = new Date(u.used_at as string);
                            const isToday = u.used_at?.toString().slice(0, 10) === todayStr;
                            return (
                              <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', background: isToday ? '#F5F3FF' : hex(INK,.03), borderRadius:10, border: isToday ? '1px solid #DDD6FE' : 'none' }}>
                                <div style={{ ...s, fontSize:12, color: isToday ? '#5B21B6' : hex(INK,.55), fontWeight: isToday ? 700 : 400 }}>
                                  {isToday ? 'Today' : usedDate.toLocaleDateString('en-MY', { day:'numeric', month:'short' })}
                                  {' · '}
                                  {usedDate.toLocaleTimeString('en-MY', { hour:'2-digit', minute:'2-digit' })}
                                </div>
                                <div style={{ ...s, fontSize:11, color: isToday ? '#5B21B6' : hex(INK,.35), fontWeight:600 }}>
                                  1 use
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Enrolled date */}
                    <div style={{ ...s, fontSize:11, color:hex(INK,.3), marginTop:12 }}>
                      Enrolled {new Date(pass.enrolled_at).toLocaleDateString('en-MY', { day:'numeric', month:'short', year:'numeric' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PassesPage() {
  return (
    <Suspense>
      <PassesContent />
    </Suspense>
  );
}

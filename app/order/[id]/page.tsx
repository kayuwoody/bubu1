'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/online/supabase-browser';
import type { Branch } from '@/lib/types';

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

const STATUS_LABEL: Record<string, string> = {
  pending:   'Order received',
  accepted:  'Your barista is on it',
  ready:     'Ready for pickup! 🎉',
  collected: 'Enjoy! ☕',
  rejected:  'Order could not be fulfilled',
};

const STATUS_SUB: Record<string, string> = {
  pending:  'We\'ve got your order — hang tight',
  accepted: 'Preparing now, won\'t be long',
  ready:    'Head over and collect your order',
  collected:'Thanks for visiting Coffee Oasis',
  rejected: 'Your payment will be refunded',
};

const STATUS_COLOR: Record<string, string> = {
  pending:   PRI,
  accepted:  '#2563EB',
  ready:     '#16A34A',
  collected: '#6B7280',
  rejected:  '#DC2626',
};

const TERMINAL = new Set(['collected', 'rejected']);

interface OrderItem {
  product_name: string;
  qty:          number;
  unit_price:   number;
  mods:         Record<string, unknown> | null;
}

interface Order {
  id:           string;
  status:       string;
  pickup_type:  string;
  customer_name:string;
  total_paid:   number;
  currency:     string;
  created_at:   string;
  reject_reason:string | null;
  online_order_items: OrderItem[];
}

function modsLabel(mods: Record<string, unknown> | null): string {
  if (!mods) return '';
  const parts: string[] = [];
  if (mods.combo_selections && typeof mods.combo_selections === 'object') {
    for (const v of Object.values(mods.combo_selections as Record<string, { name: string }>)) {
      if (v?.name) parts.push(v.name);
    }
  }
  if (mods.sugar && mods.sugar !== 'Zero') parts.push((mods.sugar as string) + ' sugar');
  if (mods.milk  && mods.milk  !== 'Full')  parts.push((mods.milk  as string) + ' milk');
  if (Array.isArray(mods.selected_optionals)) {
    for (const o of mods.selected_optionals as Array<{ name: string }>) {
      if (o?.name) parts.push(`+ ${o.name}`);
    }
  }
  if (mods.notes) parts.push(`"${mods.notes as string}"`);
  return parts.join(' · ');
}

// Status steps for the progress track
const STEPS = ['pending', 'accepted', 'ready', 'collected'] as const;
type Step = typeof STEPS[number];

function StatusTrack({ status }: { status: string }) {
  const stepIdx = STEPS.indexOf(status as Step);
  if (status === 'rejected') return null;
  const labels: Record<string, string> = { pending: 'Received', accepted: 'Preparing', ready: 'Ready', collected: 'Collected' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '0 auto 28px', maxWidth: 340, position: 'relative' }}>
      {STEPS.map((s, i) => {
        const done   = stepIdx >= i;
        const active = stepIdx === i;
        return (
          <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {/* connector line before */}
            {i > 0 && (
              <div style={{
                position: 'absolute', left: '-50%', right: '50%', top: 13, height: 3,
                background: stepIdx >= i ? STATUS_COLOR[status] ?? PRI : hex(INK, .12),
                transition: 'background 0.5s',
                zIndex: 0,
              }}/>
            )}
            <div style={{
              width: 26, height: 26, borderRadius: '50%', zIndex: 1,
              background: done ? (active ? STATUS_COLOR[status] ?? PRI : hex(INK, .6)) : '#fff',
              border: `3px solid ${done ? (active ? STATUS_COLOR[status] ?? PRI : hex(INK, .6)) : hex(INK, .15)}`,
              display: 'grid', placeItems: 'center',
              boxShadow: active ? `0 0 0 4px ${hex(STATUS_COLOR[status] ?? PRI, .15)}` : 'none',
              transition: 'all 0.5s',
            }}>
              {done && !active && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 5 5L20 7"/>
                </svg>
              )}
              {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }}/>}
            </div>
            <div style={{
              fontSize: 10, fontWeight: 700, marginTop: 5, textAlign: 'center',
              color: done ? (active ? STATUS_COLOR[status] ?? PRI : hex(INK, .6)) : hex(INK, .3),
              fontFamily: "'Nunito', system-ui", textTransform: 'uppercase', letterSpacing: '.04em',
              transition: 'color 0.5s',
            }}>
              {labels[s]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const [order,    setOrder]    = useState<Order | null>(null);
  const [error,    setError]    = useState('');
  const [branch,   setBranch]   = useState<Branch | null>(null);
  const [arrived,  setArrived]  = useState(false);
  const [arriving, setArriving] = useState(false);

  // Persist active order to localStorage so the main-page icon can read it
  const persistActive = useCallback((o: Order) => {
    if (TERMINAL.has(o.status)) {
      try { localStorage.removeItem('co_active_order'); } catch { /* ignore */ }
    } else {
      try {
        localStorage.setItem('co_active_order', JSON.stringify({
          id: o.id, created_at: o.created_at, status: o.status, pickup_type: o.pickup_type,
        }));
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    fetch('/api/branch').then(r => r.json()).then(setBranch).catch(() => {});
  }, []);

  // Initial load
  useEffect(() => {
    if (!id) return;
    fetch(`/api/orders/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setOrder(data);
        persistActive(data);
        try {
          const pending = localStorage.getItem('co_pending');
          if (pending) {
            const { lines } = JSON.parse(pending);
            localStorage.setItem('co_last_order', JSON.stringify({ items: lines, when: 'Last order' }));
            localStorage.setItem('co_session', 'true');
            localStorage.removeItem('co_pending');
          }
        } catch { /* ignore */ }
      })
      .catch(() => setError('Could not load order.'));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const sb = createBrowserClient();
    const channel = sb
      .channel(`order:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'online_orders', filter: `id=eq.${id}` },
        payload => {
          setOrder(prev => {
            if (!prev) return prev;
            const updated = { ...prev, ...(payload.new as Partial<Order>) };
            persistActive(updated);
            return updated;
          });
        }
      )
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [id, persistActive]);

  // Polling fallback every 30s
  useEffect(() => {
    if (!id) return;
    const tick = setInterval(async () => {
      const data = await fetch(`/api/orders/${id}`).then(r => r.json()).catch(() => null);
      if (data && !data.error) {
        setOrder(prev => {
          if (prev && TERMINAL.has(prev.status)) { clearInterval(tick); return prev; }
          persistActive(data);
          return data;
        });
      }
    }, 30_000);
    return () => clearInterval(tick);
  }, [id, persistActive]);

  const handleArrived = async () => {
    if (arriving || arrived) return;
    setArriving(true);
    try {
      await fetch(`/api/orders/${id}/arrived`, { method: 'POST' });
    } catch { /* ignore — optimistic */ }
    setArrived(true);
    setArriving(false);
  };

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: BG, fontFamily: "'Nunito', system-ui" }}>
      <div style={{ textAlign: 'center', color: INK }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{error}</div>
        <a href="/" style={{ color: PRI, marginTop: 12, display: 'block' }}>← Back to menu</a>
      </div>
    </div>
  );

  if (!order) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: BG }}>
      <div style={{ width: 40, height: 40, border: `3px solid ${hex(PRI, .3)}`, borderTopColor: PRI, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const statusColor = STATUS_COLOR[order.status] ?? PRI;
  const isCurbside  = order.pickup_type === 'curbside';
  const isActive    = !TERMINAL.has(order.status);

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Nunito', system-ui", paddingBottom: 60 }}>
      {/* Top status bar */}
      <div style={{
        background: statusColor, color: '#fff', padding: '20px 20px 28px',
        textAlign: 'center', transition: 'background 0.5s',
      }}>
        <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 26, lineHeight: 1.1 }}>
          {STATUS_LABEL[order.status] ?? order.status}
        </div>
        <div style={{ fontSize: 14, opacity: .85, marginTop: 4 }}>
          {STATUS_SUB[order.status] ?? ''}
        </div>
        <div style={{ marginTop: 8, fontSize: 13, opacity: .7 }}>
          Order {order.id} · {isCurbside ? 'Curbside' : 'Counter pickup'}
        </div>
      </div>

      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 16px' }}>
        {/* Progress track */}
        <div style={{ background: '#fff', borderRadius: `0 0 ${R}px ${R}px`, padding: '24px 16px 20px', marginBottom: 16, border: `1.5px solid ${hex(INK, .07)}`, borderTop: 'none' }}>
          <StatusTrack status={order.status}/>

          {/* "I'm here" curbside button */}
          {isCurbside && isActive && (
            <button
              onClick={handleArrived}
              disabled={arrived || arriving}
              style={{
                width: '100%', padding: '13px', borderRadius: R - 6,
                background: arrived ? '#16A34A' : PRI,
                color: '#fff', border: 'none',
                fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 15,
                cursor: arrived ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: arrived ? 'none' : `0 4px 0 ${hex(PRI, .35)}`,
                transition: 'background 0.3s, box-shadow 0.3s',
              }}
            >
              {arrived ? (
                <>✓ Barista notified — we'll bring it out</>
              ) : arriving ? (
                <>Notifying…</>
              ) : (
                <>📍 I've arrived — bring it out</>
              )}
            </button>
          )}
        </div>

        {/* Items */}
        <div style={{ background: '#fff', borderRadius: R, border: `1.5px solid ${hex(INK, .08)}`, padding: '4px 18px 8px', marginBottom: 12 }}>
          <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 12, color: hex(INK, .45), textTransform: 'uppercase', letterSpacing: '.05em', padding: '12px 0 6px' }}>
            Your order
          </div>
          {(order.online_order_items ?? []).map((item, i) => {
            const mods = modsLabel(item.mods);
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: `1px solid ${hex(INK, .06)}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>
                    <span style={{ color: PRI, marginRight: 6, fontFamily: "'Baloo 2', system-ui" }}>×{item.qty}</span>
                    {item.product_name}
                  </div>
                  {mods && <div style={{ fontSize: 12, color: hex(INK, .45), marginTop: 2, lineHeight: 1.4 }}>{mods}</div>}
                </div>
                <div style={{ fontSize: 13, color: hex(INK, .55), flexShrink: 0, paddingTop: 2 }}>
                  {order.currency} {(Number(item.unit_price) * item.qty).toFixed(2)}
                </div>
              </div>
            );
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 4px', fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 16, color: INK }}>
            <span>Total</span>
            <span>{order.currency} {Number(order.total_paid).toFixed(2)}</span>
          </div>
        </div>

        {/* Rejection reason */}
        {order.status === 'rejected' && (
          <div style={{ marginBottom: 12, padding: 16, background: '#FFF5F5', borderRadius: R - 4, border: `1.5px solid rgba(220,38,38,.2)` }}>
            {order.reject_reason && (
              <div style={{ fontSize: 14, color: '#DC2626', fontWeight: 700, marginBottom: 6 }}>
                Reason: {order.reject_reason}
              </div>
            )}
            <div style={{ fontSize: 13, color: hex(INK, .65), lineHeight: 1.5 }}>
              Your payment will be refunded within 3–5 business days.
            </div>
          </div>
        )}

        {/* Branch info */}
        <div style={{ padding: '12px 14px', background: '#fff', borderRadius: R - 4, border: `1.5px solid ${hex(INK, .06)}`, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: INK, marginBottom: 16 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PRI} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
          <div>
            <div style={{ fontWeight: 700, fontFamily: "'Baloo 2', system-ui" }}>{branch?.name ?? 'Coffee Oasis'}</div>
            {branch?.address && <div style={{ opacity: .6, fontSize: 12 }}>{branch.address}</div>}
          </div>
        </div>

        <a href="/" style={{
          display: 'block', textAlign: 'center', padding: '14px',
          borderRadius: R, border: `1.5px solid ${hex(INK, .15)}`, color: INK,
          fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 15,
          textDecoration: 'none',
        }}>
          ← Back to menu
        </a>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid rgba(58,36,20,.06)`, fontSize: 14 }}>
      <span style={{ color: 'rgba(58,36,20,.55)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: INK }}>{value}</span>
    </div>
  );
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
void Row;

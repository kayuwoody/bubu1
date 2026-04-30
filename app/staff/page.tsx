'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

const INK  = '#3A2414';
const PRI  = '#F58220';
const BG   = '#FFF6E8';
const R    = 16;

interface OrderItem {
  id: string;
  product_name: string;
  qty: number;
  unit_price: number;
  mods: Record<string, string>;
}

interface Order {
  id: string;
  status: 'pending' | 'accepted' | 'ready' | 'collected' | 'rejected';
  pickup_type: string;
  customer_name: string;
  customer_phone: string;
  total_paid: number;
  currency: string;
  created_at: string;
  accepted_at: string | null;
  online_order_items: OrderItem[];
}

const COL = {
  pending:  { label: 'New Orders',  accent: PRI,       cardBg: '#fff',      border: PRI },
  accepted: { label: 'In Progress', accent: '#1565C0',  cardBg: '#fff',      border: '#1565C0' },
  ready:    { label: 'Ready',       accent: '#2E7D32',  cardBg: '#F1F8F1',   border: '#2E7D32' },
} as const;

type ActiveStatus = keyof typeof COL;

function elapsed(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function ModLine({ mods }: { mods: Record<string, string> }) {
  const entries = Object.entries(mods).filter(([, v]) => v && v !== 'none' && v !== '');
  if (!entries.length) return null;
  return (
    <div style={{ fontSize: 11, color: 'rgba(58,36,20,.5)', marginTop: 1 }}>
      {entries.map(([k, v]) => `${k}: ${v}`).join(' · ')}
    </div>
  );
}

function OrderCard({
  order,
  onAction,
  busy,
}: {
  order: Order;
  onAction: (id: string, status: string, reason?: string) => void;
  busy: boolean;
}) {
  const cfg = COL[order.status as ActiveStatus];
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const timeRef = order.status === 'accepted' ? order.accepted_at : order.created_at;

  return (
    <div style={{
      background: cfg.cardBg,
      border: `2px solid ${order.status === 'pending' ? cfg.border : 'rgba(58,36,20,.1)'}`,
      borderRadius: R,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 20, color: INK, lineHeight: 1 }}>
            {order.id}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(58,36,20,.6)', marginTop: 2 }}>
            {order.customer_name} · {order.pickup_type === 'curbside' ? '🚗 Curbside' : '🏪 Counter'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'rgba(58,36,20,.5)' }}>{elapsed(timeRef ?? order.created_at)}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginTop: 2 }}>
            {order.currency} {Number(order.total_paid).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Items */}
      <div style={{ borderTop: '1px solid rgba(58,36,20,.08)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {order.online_order_items.map(item => (
          <div key={item.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: INK }}>
              <span><b style={{ marginRight: 6 }}>×{item.qty}</b>{item.product_name}</span>
            </div>
            <ModLine mods={item.mods ?? {}} />
          </div>
        ))}
      </div>

      {/* Actions */}
      {order.status === 'pending' && !rejecting && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            disabled={busy}
            onClick={() => onAction(order.id, 'accepted')}
            style={{ flex: 1, padding: '10px 0', borderRadius: R - 4, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', background: '#2E7D32', color: '#fff', fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 14, opacity: busy ? .6 : 1 }}
          >Accept</button>
          <button
            disabled={busy}
            onClick={() => setRejecting(true)}
            style={{ flex: 1, padding: '10px 0', borderRadius: R - 4, border: '1.5px solid #C62828', cursor: busy ? 'not-allowed' : 'pointer', background: '#fff', color: '#C62828', fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 14, opacity: busy ? .6 : 1 }}
          >Reject</button>
        </div>
      )}

      {order.status === 'pending' && rejecting && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            autoFocus
            placeholder="Reason (optional)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: R - 6, border: '1.5px solid rgba(58,36,20,.2)', fontSize: 13, fontFamily: "'Nunito', system-ui", outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              disabled={busy}
              onClick={() => { onAction(order.id, 'rejected', reason); setRejecting(false); setReason(''); }}
              style={{ flex: 1, padding: '9px 0', borderRadius: R - 4, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', background: '#C62828', color: '#fff', fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 14, opacity: busy ? .6 : 1 }}
            >Confirm Reject</button>
            <button
              onClick={() => { setRejecting(false); setReason(''); }}
              style={{ padding: '9px 14px', borderRadius: R - 4, border: '1.5px solid rgba(58,36,20,.15)', cursor: 'pointer', background: '#fff', color: INK, fontFamily: "'Baloo 2', system-ui", fontWeight: 600, fontSize: 14 }}
            >Cancel</button>
          </div>
        </div>
      )}

      {order.status === 'accepted' && (
        <button
          disabled={busy}
          onClick={() => onAction(order.id, 'ready')}
          style={{ padding: '10px 0', borderRadius: R - 4, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', background: '#1565C0', color: '#fff', fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 14, opacity: busy ? .6 : 1 }}
        >Mark Ready</button>
      )}

      {order.status === 'ready' && (
        <button
          disabled={busy}
          onClick={() => onAction(order.id, 'collected')}
          style={{ padding: '10px 0', borderRadius: R - 4, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', background: '#546E7A', color: '#fff', fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 14, opacity: busy ? .6 : 1 }}
        >Collected ✓</button>
      )}
    </div>
  );
}

export default function StaffPage() {
  const [orders, setOrders]           = useState<Order[]>([]);
  const [paused, setPaused]           = useState(false);
  const [avgWait, setAvgWait]         = useState(0);
  const [loading, setLoading]         = useState(true);
  const [busy, setBusy]               = useState<string | null>(null);
  const [lastPendingIds, setLastPendingIds] = useState<Set<string>>(new Set());
  const [tick, setTick]               = useState(0);
  const audioRef = useRef<AudioContext | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res  = await fetch('/api/online/orders?outlet=main');
      const data = await res.json();
      if (!res.ok) return;

      const incoming: Order[] = data.orders ?? [];
      const newPendingIds = new Set(incoming.filter(o => o.status === 'pending').map(o => o.id));

      // Beep if there are new pending orders we haven't seen before
      setLastPendingIds(prev => {
        const isNew = [...newPendingIds].some(id => !prev.has(id));
        if (isNew) {
          try {
            if (!audioRef.current) audioRef.current = new AudioContext();
            const ctx = audioRef.current;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start(); osc.stop(ctx.currentTime + 0.4);
          } catch { /* audio blocked */ }
        }
        return newPendingIds;
      });

      setOrders(incoming);
      setPaused(data.intake_paused ?? false);
      setAvgWait(data.avg_wait_seconds ?? 0);
      setLoading(false);
    } catch { /* network blip */ }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders, tick]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // Elapsed timer re-renders every 15s
  const [, forceRender] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceRender(n => n + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const doAction = useCallback(async (id: string, status: string, reason?: string) => {
    setBusy(id);
    try {
      await fetch(`/api/online/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(reason ? { reject_reason: reason } : {}) }),
      });
      await fetchOrders();
    } finally {
      setBusy(null);
    }
  }, [fetchOrders]);

  const togglePause = useCallback(async () => {
    const next = !paused;
    setPaused(next);
    await fetch('/api/online/orders/main', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intake_paused: next, outlet_id: 'main' }),
    });
  }, [paused]);

  const cols: ActiveStatus[] = ['pending', 'accepted', 'ready'];
  const byStatus = (s: ActiveStatus) => orders.filter(o => o.status === s);
  const pendingCount = byStatus('pending').length;

  const avgMin = avgWait ? `~${Math.ceil(avgWait / 60)}m wait` : null;

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: BG }}>
      <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 18, color: INK }}>Loading…</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Nunito', system-ui" }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1.5px solid rgba(58,36,20,.1)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 20, color: INK }}>
            Coffee Oasis
            {pendingCount > 0 && (
              <span style={{ marginLeft: 8, background: PRI, color: '#fff', borderRadius: 99, fontSize: 13, fontWeight: 700, padding: '2px 8px' }}>
                {pendingCount} new
              </span>
            )}
          </div>
          {avgMin && <div style={{ fontSize: 13, color: 'rgba(58,36,20,.5)' }}>{avgMin}</div>}
        </div>

        <button
          onClick={togglePause}
          style={{
            padding: '8px 16px', borderRadius: 99,
            border: paused ? 'none' : '1.5px solid rgba(58,36,20,.2)',
            background: paused ? PRI : '#fff',
            color: paused ? '#fff' : INK,
            fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {paused ? '▶ Resume Orders' : '⏸ Pause Orders'}
        </button>
      </div>

      {paused && (
        <div style={{ background: '#FFF3CD', borderBottom: '1px solid #FFE082', padding: '10px 20px', textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#7B5800' }}>
          ⚠️ New orders are paused — customers see a "temporarily unavailable" message
        </div>
      )}

      {/* Columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        padding: 16,
        alignItems: 'start',
      }}>
        {cols.map(status => {
          const cfg = COL[status];
          const colOrders = byStatus(status);
          return (
            <div key={status}>
              {/* Column header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 10, padding: '6px 10px',
                background: cfg.accent + '18', borderRadius: 10,
              }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.accent }} />
                <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 14, color: cfg.accent }}>
                  {cfg.label}
                </div>
                <div style={{ marginLeft: 'auto', fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 13, color: cfg.accent }}>
                  {colOrders.length || ''}
                </div>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {colOrders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'rgba(58,36,20,.35)' }}>
                    {status === 'pending' ? 'No new orders' : '—'}
                  </div>
                ) : (
                  colOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onAction={doAction}
                      busy={busy === order.id}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @media (max-width: 700px) {
          div[style*="repeat(3, 1fr)"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/online/supabase-browser';

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
  pending:   'Received — preparing your order',
  accepted:  'Order accepted — your barista is on it',
  ready:     'Ready for pickup! 🎉',
  collected: 'Collected — enjoy!',
  rejected:  'Order could not be fulfilled',
};

const STATUS_COLOR: Record<string, string> = {
  pending:   PRI,
  accepted:  '#2E7D32',
  ready:     '#1B5E20',
  collected: '#757575',
  rejected:  '#C62828',
};

const TERMINAL = new Set(['collected', 'rejected']);

interface OrderItem {
  product_name: string;
  qty: number;
  unit_price: number;
  mods: Record<string, string>;
}

interface Order {
  id: string;
  status: string;
  pickup_type: string;
  customer_name: string;
  total_paid: number;
  currency: string;
  created_at: string;
  online_order_items: OrderItem[];
}

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  // Initial load
  useEffect(() => {
    if (!id) return;
    fetch(`/api/orders/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setOrder(data);
      })
      .catch(() => setError('Could not load order.'));
  }, [id]);

  // Realtime subscription for instant status updates from POS
  useEffect(() => {
    if (!id) return;

    const sb = createBrowserClient();
    const channel = sb
      .channel(`order:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'online_orders', filter: `id=eq.${id}` },
        payload => {
          setOrder(prev => prev ? { ...prev, ...(payload.new as Partial<Order>) } : prev);
        }
      )
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [id]);

  // Fallback poll every 30s in case Realtime drops
  useEffect(() => {
    if (!id) return;
    const tick = setInterval(async () => {
      const data = await fetch(`/api/orders/${id}`).then(r => r.json()).catch(() => null);
      if (data && !data.error) setOrder(prev => {
        if (prev && TERMINAL.has(prev.status)) { clearInterval(tick); return prev; }
        return data;
      });
    }, 30_000);
    return () => clearInterval(tick);
  }, [id]);

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
  const statusLabel = STATUS_LABEL[order.status] ?? order.status;
  const isReady     = order.status === 'ready';

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Nunito', system-ui", padding: '32px 16px 60px' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>

        {/* Status icon */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: statusColor, color: '#fff',
            display: 'inline-grid', placeItems: 'center',
            boxShadow: `0 6px 0 ${hex(statusColor, .3)}`,
            transition: 'background 0.4s, box-shadow 0.4s',
          }}>
            {isReady ? (
              <span style={{ fontSize: 36 }}>🎉</span>
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 5 5L20 7"/>
              </svg>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 32, color: INK, lineHeight: 1 }}>
            Order {order.id}
          </div>
          <div style={{ marginTop: 10, fontSize: 16, color: statusColor, fontWeight: 700, transition: 'color 0.4s' }}>
            {statusLabel}
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: hex(INK, .55) }}>
            {order.pickup_type === 'curbside' ? 'Curbside pickup' : 'Counter pickup'} · Shell Seksyen 13, PJ
          </div>
        </div>

        <img src="/co-mascot.png" alt="" style={{ width: 140, display: 'block', margin: '0 auto 24px', transform: 'rotate(-4deg)', filter: 'drop-shadow(0 8px 0 rgba(58,36,20,.15))' }}/>

        <div style={{ background: '#fff', borderRadius: R, border: `1.5px solid ${hex(INK, .08)}`, padding: 18 }}>
          {(order.online_order_items ?? []).map((item, i) => {
            const mods = Object.entries(item.mods ?? {}).filter(([, v]) => v && v !== 'none' && v !== '');
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid rgba(58,36,20,.06)` }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>
                    <span style={{ color: PRI, marginRight: 6 }}>×{item.qty}</span>{item.product_name}
                  </div>
                  {mods.length > 0 && (
                    <div style={{ fontSize: 12, color: hex(INK, .45), marginTop: 2 }}>
                      {mods.map(([, v]) => v).join(' · ')}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 14, color: hex(INK, .55), marginLeft: 12, whiteSpace: 'nowrap' }}>
                  {order.currency} {(item.unit_price * item.qty).toFixed(2)}
                </div>
              </div>
            );
          })}
          <Row label="Customer" value={order.customer_name}/>
          <Row label="Total paid" value={`${order.currency} ${Number(order.total_paid).toFixed(2)}`}/>
          <Row label="Pickup" value={order.pickup_type === 'curbside' ? 'Curbside' : 'At counter'}/>
        </div>

        <div style={{ marginTop: 16, padding: 14, background: '#fff', borderRadius: R - 4, border: `1.5px solid ${hex(INK, .06)}`, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: INK }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
          <div>
            <div style={{ fontWeight: 700 }}>Coffee Oasis · Shell Seksyen 13</div>
            <div style={{ opacity: .6, fontSize: 12 }}>Jalan Universiti, 46200 Petaling Jaya</div>
          </div>
        </div>

        <a href="/" style={{
          display: 'block', marginTop: 24, textAlign: 'center',
          padding: '14px', borderRadius: R,
          border: `1.5px solid ${hex(INK, .15)}`, color: INK,
          fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 15,
          textDecoration: 'none',
        }}>Order again</a>
      </div>
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


function hex(h: string, a = 1) {
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const STATUS_LABEL: Record<string, string> = {
  pending:   'Received — preparing your order',
  accepted:  'Order accepted — your barista is on it',
  ready:     'Ready for pickup! 🎉',
  collected: 'Collected — enjoy!',
  rejected:  'Order could not be fulfilled',
};

const STATUS_COLOR: Record<string, string> = {
  pending:   PRI,
  accepted:  '#2E7D32',
  ready:     '#1B5E20',
  collected: '#757575',
  rejected:  '#C62828',
};

interface OrderItem {
  product_name: string;
  qty: number;
  unit_price: number;
  mods: Record<string, string>;
}

interface Order {
  id: string;
  status: string;
  pickup_type: string;
  customer_name: string;
  total_paid: number;
  currency: string;
  created_at: string;
  online_order_items: OrderItem[];
}

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const [order,  setOrder]  = useState<Order | null>(null);
  const [error,  setError]  = useState('');
  const [polled, setPolled] = useState(0);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        const res  = await fetch(`/api/orders/${id}`);
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Order not found'); return; }
        setOrder(data);
        // Keep polling if order isn't terminal
        if (!['collected', 'rejected'].includes(data.status)) {
          setTimeout(() => setPolled(p => p + 1), 10000);
        }
      } catch {
        setError('Could not load order.');
      }
    };

    load();
  }, [id, polled]);

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
  const statusLabel = STATUS_LABEL[order.status] ?? order.status;
  const isReady     = order.status === 'ready';

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Nunito', system-ui", padding: '32px 16px 60px' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>

        {/* Check circle */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: statusColor, color: '#fff',
            display: 'inline-grid', placeItems: 'center',
            boxShadow: `0 6px 0 ${hex(statusColor, .3)}`,
          }}>
            {isReady ? (
              <span style={{ fontSize: 36 }}>🎉</span>
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 5 5L20 7"/>
              </svg>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 32, color: INK, lineHeight: 1 }}>
            Order {order.id}
          </div>
          <div style={{ marginTop: 10, fontSize: 16, color: statusColor, fontWeight: 700 }}>{statusLabel}</div>
          <div style={{ marginTop: 4, fontSize: 13, color: hex(INK, .55) }}>
            {order.pickup_type === 'curbside' ? 'Curbside pickup' : 'Counter pickup'} · Shell Seksyen 13, PJ
          </div>
        </div>

        <img src="/co-mascot.png" alt="" style={{ width: 140, display: 'block', margin: '0 auto 24px', transform: 'rotate(-4deg)', filter: 'drop-shadow(0 8px 0 rgba(58,36,20,.15))' }}/>

        <div style={{ background: '#fff', borderRadius: R, border: `1.5px solid ${hex(INK, .08)}`, padding: 18 }}>
          {(order.online_order_items ?? []).map((item, i) => {
            const mods = Object.entries(item.mods ?? {}).filter(([, v]) => v && v !== 'none' && v !== '');
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid rgba(58,36,20,.06)` }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>
                    <span style={{ color: PRI, marginRight: 6 }}>×{item.qty}</span>{item.product_name}
                  </div>
                  {mods.length > 0 && (
                    <div style={{ fontSize: 12, color: hex(INK, .45), marginTop: 2 }}>
                      {mods.map(([, v]) => v).join(' · ')}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 14, color: hex(INK, .55), marginLeft: 12, whiteSpace: 'nowrap' }}>
                  {order.currency} {(item.unit_price * item.qty).toFixed(2)}
                </div>
              </div>
            );
          })}
          <Row label="Customer" value={order.customer_name}/>
          <Row label="Total paid" value={`${order.currency} ${Number(order.total_paid).toFixed(2)}`}/>
          <Row label="Pickup" value={order.pickup_type === 'curbside' ? 'Curbside' : 'At counter'}/>
        </div>

        <div style={{ marginTop: 16, padding: 14, background: '#fff', borderRadius: R - 4, border: `1.5px solid ${hex(INK, .06)}`, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: INK }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
          <div>
            <div style={{ fontWeight: 700 }}>Coffee Oasis · Shell Seksyen 13</div>
            <div style={{ opacity: .6, fontSize: 12 }}>Jalan Universiti, 46200 Petaling Jaya</div>
          </div>
        </div>

        <a href="/" style={{
          display: 'block', marginTop: 24, textAlign: 'center',
          padding: '14px', borderRadius: R,
          border: `1.5px solid ${hex(INK, .15)}`, color: INK,
          fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 15,
          textDecoration: 'none',
        }}>Order again</a>
      </div>
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

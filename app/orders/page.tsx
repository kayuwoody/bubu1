'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { CartLine } from '@/lib/types';

const INK = '#3A2414';
const PRI = '#F58220';
const R   = 22;

function hex(h: string, a = 1) {
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const STATUS_LABEL: Record<string, string> = {
  pending:   'Pending',
  accepted:  'Accepted',
  ready:     'Ready',
  collected: 'Collected',
  rejected:  'Rejected',
  completed: 'Completed',
  paid:      'Completed',
  voided:    'Voided',
};

const STATUS_COLOR: Record<string, string> = {
  pending:   '#92400E',
  accepted:  '#1D4ED8',
  ready:     '#15803D',
  collected: '#6B7280',
  rejected:  '#DC2626',
  completed: '#6B7280',
  paid:      '#6B7280',
  voided:    '#DC2626',
};

const STATUS_BG: Record<string, string> = {
  pending:   '#FEF3C7',
  accepted:  '#DBEAFE',
  ready:     '#DCFCE7',
  collected: '#F3F4F6',
  rejected:  '#FEE2E2',
  completed: '#F3F4F6',
  paid:      '#F3F4F6',
  voided:    '#FEE2E2',
};

interface OrderItem {
  product_id:   string;
  product_name: string;
  qty:          number;
  unit_price:   number;
  mods:         Record<string, unknown> | null;
}

interface Order {
  id:           string;
  order_number?: string;
  source:       'online' | 'pos';
  status:       string;
  pickup_type:  string | null;
  total_paid:   number;
  created_at:   string;
  items:        OrderItem[];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
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
  if (mods.milk && mods.milk !== 'Full') parts.push((mods.milk as string) + ' milk');
  if (Array.isArray(mods.selected_optionals)) {
    for (const o of mods.selected_optionals as Array<{ name: string }>) {
      if (o?.name) parts.push(`+ ${o.name}`);
    }
  }
  if (mods.notes) parts.push(`"${mods.notes as string}"`);
  return parts.join(' · ');
}

function OrdersContent() {
  const router = useRouter();
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone,   setPhone]   = useState('');
  const [reordering, setReordering] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('co_form') ?? '{}');
      const p = (saved.phone ?? '').replace(/\D/g, '');
      setPhone(p);
      if (p.length >= 8) {
        fetch(`/api/orders?phone=${p}`)
          .then(r => r.json())
          .then(d => setOrders(d.orders ?? []))
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  const reorder = (order: Order) => {
    setReordering(order.id);
    const lines: CartLine[] = order.items.map(item => ({
      lid:       `${item.product_id}-reorder-${Date.now()}`,
      id:        item.product_id,
      name:      item.product_name,
      qty:       item.qty,
      mods:      item.mods,
      unitPrice: Number(item.unit_price),
    }));
    const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    try {
      localStorage.setItem('co_pending', JSON.stringify({ lines, pickup: order.pickup_type ?? 'counter', total }));
    } catch { /* ignore */ }
    router.push('/checkout');
  };

  const s: React.CSSProperties = { fontFamily: "'Nunito', system-ui" };
  const heading: React.CSSProperties = { fontFamily: "'Baloo 2', system-ui", fontWeight: 800, color: INK };

  return (
    <div style={{ minHeight: '100vh', background: '#EFE4D1', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: INK, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '4px 8px 4px 0' }}
        >
          ←
        </button>
        <div style={{ ...heading, fontSize: 18, color: '#fff' }}>Order History</div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>
        {loading ? (
          <div style={{ ...s, textAlign: 'center', color: hex(INK, .45), padding: '40px 0' }}>Loading orders…</div>
        ) : !phone ? (
          <div style={{ background: '#FFF6E8', borderRadius: R, padding: 24, textAlign: 'center', border: `2px solid ${hex(INK, .1)}` }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
            <div style={{ ...heading, fontSize: 18, marginBottom: 6 }}>No account linked</div>
            <div style={{ ...s, fontSize: 14, color: hex(INK, .6), marginBottom: 16 }}>
              Complete a purchase first — your orders will appear here.
            </div>
            <button onClick={() => router.back()} style={{ background: PRI, color: '#fff', border: 'none', borderRadius: 999, padding: '10px 24px', ...s, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Go back
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ background: '#FFF6E8', borderRadius: R, padding: 24, textAlign: 'center', border: `2px solid ${hex(INK, .1)}` }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
            <div style={{ ...heading, fontSize: 18, marginBottom: 6 }}>No orders yet</div>
            <div style={{ ...s, fontSize: 14, color: hex(INK, .6), marginBottom: 16 }}>
              Your order history will appear here after your first purchase.
            </div>
            <button onClick={() => router.back()} style={{ background: PRI, color: '#fff', border: 'none', borderRadius: 999, padding: '10px 24px', ...s, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Go back
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {orders.map(order => {
              const status = order.status ?? 'pending';
              const items  = order.items ?? [];
              return (
                <div key={order.id} style={{ background: '#fff', borderRadius: R - 2, overflow: 'hidden', border: `1.5px solid ${hex(INK, .08)}` }}>
                  {/* Order header — online orders tap through to detail page */}
                  <div
                    onClick={() => order.source === 'online' ? router.push(`/order/${order.id}`) : undefined}
                    style={{ padding: '12px 16px', borderBottom: `1px solid ${hex(INK, .07)}`, display: 'flex', alignItems: 'center', gap: 10, cursor: order.source === 'online' ? 'pointer' : 'default' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ ...heading, fontSize: 16 }}>
                          {order.source === 'pos' && order.order_number ? `#${order.order_number}` : `Order #${order.id}`}
                        </span>
                        <span style={{
                          ...s, fontSize: 12, fontWeight: 700,
                          background: STATUS_BG[status] ?? '#F3F4F6',
                          color: STATUS_COLOR[status] ?? INK,
                          padding: '2px 8px', borderRadius: 999,
                        }}>
                          {STATUS_LABEL[status] ?? status}
                        </span>
                        {order.source === 'pos' && (
                          <span style={{ ...s, fontSize: 11, fontWeight: 700, background: hex(INK, .07), color: hex(INK, .5), padding: '2px 8px', borderRadius: 999 }}>
                            In-store
                          </span>
                        )}
                      </div>
                      <div style={{ ...s, fontSize: 12, color: hex(INK, .5), marginTop: 2 }}>
                        {formatDate(order.created_at)}
                        {order.source === 'online' && ' · '}
                        {order.source === 'online' && (order.pickup_type === 'curbside' ? 'Curbside' : 'Counter pickup')}
                      </div>
                    </div>
                    <div style={{ ...heading, fontSize: 18, flexShrink: 0 }}>
                      RM {Number(order.total_paid).toFixed(2)}
                    </div>
                  </div>

                  {/* Items */}
                  <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {items.map((item, i) => {
                      const mods = modsLabel(item.mods);
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <span style={{ ...s, fontSize: 14, color: INK, fontWeight: 600 }}>
                              {item.qty}× {item.product_name}
                            </span>
                            {mods && (
                              <div style={{ ...s, fontSize: 12, color: hex(INK, .5), marginTop: 1 }}>{mods}</div>
                            )}
                          </div>
                          <span style={{ ...s, fontSize: 13, color: hex(INK, .6), flexShrink: 0 }}>
                            RM {(Number(item.unit_price) * item.qty).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reorder button */}
                  <div style={{ padding: '10px 16px 14px' }}>
                    <button
                      onClick={() => reorder(order)}
                      disabled={reordering === order.id}
                      style={{
                        width: '100%', padding: '11px',
                        background: reordering === order.id ? hex(PRI, .6) : PRI,
                        color: '#fff', border: 'none', borderRadius: R - 8,
                        ...s, fontWeight: 700, fontSize: 14,
                        cursor: reordering === order.id ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {reordering === order.id ? 'Loading…' : 'Order again →'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 56, zIndex: 14, background: '#EFE4D1', borderTop: `1px solid ${hex(INK, .1)}`, display: 'flex', alignItems: 'center', boxShadow: `0 -4px 16px ${hex(INK, .07)}` }}>
        {[
          { icon: '🏠', label: 'Menu',    onClick: () => router.push('/') },
          { icon: '🧾', label: 'Orders',  active: true },
          { icon: '★',  label: 'Rewards', onClick: () => router.push('/?rewards=1') },
        ].map(item => (
          <button
            key={item.label}
            onClick={item.onClick}
            style={{ flex: 1, height: '100%', border: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: item.active ? 'default' : 'pointer', color: item.active ? PRI : hex(INK, .5), fontFamily: "'Nunito', system-ui" }}
          >
            <span style={{ fontSize: item.label === 'Rewards' ? 16 : 18 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersContent />
    </Suspense>
  );
}

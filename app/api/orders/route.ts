import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';
import { normalisePhone } from '@/lib/normalisePhone';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = normalisePhone(searchParams.get('phone') ?? '');
  if (phone.length < 8) return NextResponse.json({ orders: [] });

  const [onlineRes, posRes] = await Promise.all([
    supabase
      .from('online_orders')
      .select('id, status, pickup_type, total_paid, created_at, online_order_items(product_id, product_name, qty, unit_price, mods)')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('pos_orders')
      .select('id, order_number, status, total, created_at, pos_order_items(product_id, product_name, qty, unit_price, subtotal)')
      .eq('loyalty_member_phone', phone)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  if (onlineRes.error) console.error('[orders] online fetch error:', onlineRes.error.message);
  if (posRes.error)    console.error('[orders] pos fetch error:', posRes.error.message, '| phone:', phone);

  const online = (onlineRes.data ?? []).map(o => ({
    id:          o.id,
    source:      'online' as const,
    status:      o.status ?? 'pending',
    pickup_type: o.pickup_type ?? null,
    total_paid:  o.total_paid,
    created_at:  o.created_at,
    items:       o.online_order_items ?? [],
  }));

  const pos = (posRes.data ?? []).map((o: { id: string; order_number: string; status: string; total: number; created_at: string; pos_order_items: unknown[] }) => ({
    id:           o.id,
    order_number: o.order_number,
    source:       'pos' as const,
    status:       o.status ?? 'completed',
    pickup_type:  null,
    total_paid:   o.total,
    created_at:   o.created_at,
    items:        o.pos_order_items ?? [],
  }));

  const orders = [...online, ...pos]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50);

  return NextResponse.json({ orders });
}

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = (searchParams.get('phone') ?? '').replace(/\D/g, '');
  if (phone.length < 8) return NextResponse.json({ orders: [] });

  const { data: orders, error } = await supabase
    .from('online_orders')
    .select(`
      id, status, pickup_type, total_paid, created_at,
      online_order_items ( product_id, product_name, qty, unit_price, mods )
    `)
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) console.error('[orders] fetch error:', error.message);

  return NextResponse.json({ orders: orders ?? [] });
}

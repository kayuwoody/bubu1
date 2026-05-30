import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';
import { normalisePhone } from '@/lib/normalisePhone';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const phone = normalisePhone(new URL(req.url).searchParams.get('phone') ?? '');

  let query = supabase
    .from('online_orders')
    .select('id, status, pickup_type, customer_name, customer_phone, total_paid, currency, created_at, updated_at, reject_reason, online_order_items ( product_name, qty, unit_price, mods )')
    .eq('id', id);

  if (phone.length >= 8) {
    query = query.eq('customer_phone', phone);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Strip internal field before returning
  const { customer_phone: _cp, ...orderData } = data;
  return NextResponse.json({ ...orderData, receipt_url: `/receipts/online/${data.id}` });
}

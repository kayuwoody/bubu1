import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const { data, error } = await supabase
    .from('online_orders')
    .select('id, status, pickup_type, customer_name, total_paid, currency, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

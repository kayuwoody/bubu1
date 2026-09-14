import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';
import { storeStatus } from '@/lib/online/hours';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [productsRes, settingsRes] = await Promise.all([
    supabase.from('online_products').select('id, available, stock_count').eq('outlet_id', 'main'),
    supabase.from('outlet_settings').select('intake_paused').eq('outlet_id', 'main').single(),
  ]);

  const unavailable: string[] = [];
  for (const p of productsRes.data ?? []) {
    if (!p.available || (p.stock_count !== null && p.stock_count <= 0)) {
      unavailable.push(p.id);
    }
  }

  const paused = settingsRes.data?.intake_paused ?? false;
  const status = storeStatus();
  const orderingClosed = paused || !status.open;
  const orderingMessage = paused
    ? 'Online ordering is temporarily paused — please try again shortly.'
    : (!status.open ? status.message : '');

  return NextResponse.json({
    intake_paused: paused,
    ordering_closed: orderingClosed,
    ordering_message: orderingMessage,
    unavailable,
  });
}

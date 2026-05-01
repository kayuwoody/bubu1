import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

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

  return NextResponse.json({
    intake_paused: settingsRes.data?.intake_paused ?? false,
    unavailable,
  });
}

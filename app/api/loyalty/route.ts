import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date().toISOString();

  const [settingsRes, redemptionsRes] = await Promise.all([
    supabase
      .from('loyalty_settings')
      .select('id, points_per_rm, min_spend_for_points, is_active')
      .eq('id', 'main')
      .single(),
    supabase
      .from('loyalty_redemptions')
      .select('id, name, description, points_required, reward_type, reward_value, reward_item_id, valid_from, valid_until, sort_order')
      .eq('is_active', true)
      .or(`valid_until.is.null,valid_until.gte.${now}`)
      .or(`valid_from.is.null,valid_from.lte.${now}`)
      .order('sort_order')
      .order('points_required'),
  ]);

  return NextResponse.json({
    settings:    settingsRes.data ?? null,
    redemptions: redemptionsRes.data ?? [],
  });
}

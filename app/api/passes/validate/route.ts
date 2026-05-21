import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';
import type { CartLine } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { code: string; items: CartLine[] };
  try { body = await req.json(); } catch { return NextResponse.json({ valid: false, reason: 'Invalid request' }, { status: 400 }); }

  const { code, items } = body;
  if (!code) return NextResponse.json({ valid: false, reason: 'No pass code provided' });

  // Look up the pass enrollment + program details including daily limit
  const { data: enrollment } = await supabase
    .from('loyalty_member_programs')
    .select('id, points_balance, loyalty_programs(id, name, pass_daily_limit)')
    .eq('code', code.trim().toUpperCase())
    .single();

  if (!enrollment) return NextResponse.json({ valid: false, reason: 'Pass not found' });
  if (enrollment.points_balance <= 0) return NextResponse.json({ valid: false, reason: 'No uses remaining on this pass' });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prog = enrollment.loyalty_programs as any;
  const dailyLimit: number | null = prog?.pass_daily_limit ?? null;

  // Check daily limit if set
  let allowedToday = enrollment.points_balance; // unlimited by default
  if (dailyLimit !== null) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { count: todayCount } = await supabase
      .from('member_pass_usage')
      .select('*', { count: 'exact', head: true })
      .eq('enrollment_id', enrollment.id)
      .gte('used_at', todayStart.toISOString());

    const todayUsed = todayCount ?? 0;
    const remainingToday = dailyLimit - todayUsed;

    if (remainingToday <= 0) {
      return NextResponse.json({
        valid: false,
        reason: `You've already used your daily allowance (${dailyLimit} use${dailyLimit !== 1 ? 's' : ''}/day) for this pass. Come back tomorrow!`,
        daily_limit: dailyLimit,
        today_used: todayUsed,
      });
    }
    allowedToday = remainingToday;
  }

  // Fetch eligible products for this program
  const { data: eligible } = await supabase
    .from('loyalty_program_products')
    .select('product_id')
    .eq('program_id', prog?.id);

  const eligibleIds = new Set((eligible ?? []).map((e: { product_id: string }) => e.product_id));

  // Find matching cart items
  const matchingItems = (items ?? []).filter(l => eligibleIds.has(l.id));
  if (matchingItems.length === 0) {
    return NextResponse.json({ valid: false, reason: 'Your cart has no items covered by this pass' });
  }

  // Cap by: uses remaining on pass AND daily allowance remaining
  const cartEligibleQty = matchingItems.reduce((s, l) => s + l.qty, 0);
  const usesToApply = Math.min(enrollment.points_balance, allowedToday, cartEligibleQty);

  // Discount = unit price × covered qty
  let discount = 0;
  let remaining = usesToApply;
  for (const l of matchingItems) {
    if (remaining <= 0) break;
    const covered = Math.min(l.qty, remaining);
    discount += covered * l.unitPrice;
    remaining -= covered;
  }

  return NextResponse.json({
    valid: true,
    discount_amount: Math.round(discount * 100) / 100,
    pass_name: prog?.name ?? 'Pass',
    uses_applied: usesToApply,
    uses_left: enrollment.points_balance,
    daily_limit: dailyLimit,
    ...(dailyLimit !== null ? { today_remaining: allowedToday } : {}),
  });
}

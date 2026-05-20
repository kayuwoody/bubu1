import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';
import type { CartLine } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { code: string; items: CartLine[] };
  try { body = await req.json(); } catch { return NextResponse.json({ valid: false, reason: 'Invalid request' }, { status: 400 }); }

  const { code, items } = body;
  if (!code) return NextResponse.json({ valid: false, reason: 'No pass code provided' });

  // Look up the pass enrollment
  const { data: enrollment } = await supabase
    .from('loyalty_member_programs')
    .select('id, points_balance, loyalty_programs(id, name)')
    .eq('code', code.trim().toUpperCase())
    .single();

  if (!enrollment) return NextResponse.json({ valid: false, reason: 'Pass not found' });
  if (enrollment.points_balance <= 0) return NextResponse.json({ valid: false, reason: 'No uses remaining on this pass' });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prog = enrollment.loyalty_programs as any;

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

  // One use = one eligible item (qty 1). Cover as many as uses_left allows.
  const usesToApply = Math.min(enrollment.points_balance, matchingItems.reduce((s, l) => s + l.qty, 0));
  // Discount = unit price of eligible items up to usesToApply qty
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
  });
}

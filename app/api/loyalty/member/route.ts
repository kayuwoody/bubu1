import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = (searchParams.get('phone') ?? '').replace(/\D/g, '');
  if (phone.length < 8) return NextResponse.json({ member: null, vouchers: [], usedVouchers: [], transactions: [], programBalances: [] });

  const { data: member } = await supabase
    .from('loyalty_members')
    .select('*')
    .eq('phone', phone)
    .single();

  if (!member) {
    return NextResponse.json({ member: null, vouchers: [], usedVouchers: [], transactions: [], programBalances: [] });
  }

  const now = new Date().toISOString();

  const [{ data: allVouchers }, { data: transactions }, { data: programBalances }] = await Promise.all([
    supabase
      .from('vouchers')
      .select('*')
      .eq('member_id', member.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('member_id', member.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('loyalty_member_programs')
      .select('id, code, points_balance, total_earned, enrolled_at, updated_at, loyalty_programs(id, name, trigger_type, threshold, voucher_type, voucher_discount_value, pass_daily_limit)')
      .eq('member_id', member.id),
  ]);

  const activeVouchers: typeof allVouchers = [];
  const usedVouchers:   typeof allVouchers = [];

  for (const v of allVouchers ?? []) {
    const fullyUsed = Number(v.times_used) >= Number(v.max_uses);
    const expired   = v.expires_at != null && v.expires_at <= now;
    const inactive  = !v.is_active;
    if (fullyUsed || expired || inactive) {
      usedVouchers.push(v);
    } else {
      activeVouchers.push(v);
    }
  }

  return NextResponse.json({
    member,
    vouchers:      activeVouchers,
    usedVouchers,
    transactions:  transactions ?? [],
    programBalances: programBalances ?? [],
  });
}

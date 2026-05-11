import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = (searchParams.get('phone') ?? '').replace(/\D/g, '');
  if (phone.length < 8) return NextResponse.json({ member: null, vouchers: [], transactions: [] });

  const { data: member } = await supabase
    .from('loyalty_members')
    .select('*')
    .eq('phone', phone)
    .single();

  if (!member) {
    return NextResponse.json({ member: null, vouchers: [], transactions: [] });
  }

  const now = new Date().toISOString();

  const [{ data: vouchers }, { data: transactions }, { data: programBalances }] = await Promise.all([
    supabase
      .from('vouchers')
      .select('*')
      .eq('member_id', member.id)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('member_id', member.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('loyalty_member_programs')
      .select('points_balance, total_earned, enrolled_at, updated_at, loyalty_programs(id, name, trigger_type, threshold, voucher_type, voucher_discount_value)')
      .eq('member_id', member.id),
  ]);

  const activeVouchers = (vouchers ?? []).filter(v => v.times_used < v.max_uses);

  return NextResponse.json({
    member,
    vouchers: activeVouchers,
    transactions: transactions ?? [],
    programBalances: programBalances ?? [],
  });
}

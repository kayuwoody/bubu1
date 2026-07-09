import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';
import { normalisePhone, isValidMalaysianPhone } from '@/lib/normalisePhone';
import { issueWelcomeVoucher } from '@/lib/online/welcomeVoucher';

export const dynamic = 'force-dynamic';

function todayMYT(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

function endOfDayMYT(): Date {
  const todayStr = todayMYT();
  const [y, m, d] = todayStr.split('-').map(Number);
  const expiryUTC = new Date(Date.UTC(y, m - 1, d, 16, 0, 0, 0));
  if (Date.now() > expiryUTC.getTime()) expiryUTC.setUTCDate(expiryUTC.getUTCDate() + 1);
  return expiryUTC;
}

export async function POST(req: Request) {
  let body: { phone: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const phone = normalisePhone(body.phone ?? '');
  if (!isValidMalaysianPhone(phone)) {
    return NextResponse.json({ error: 'Invalid phone' }, { status: 400 });
  }

  const { data: programs, error: progErr } = await supabase
    .from('loyalty_programs')
    .select('id, name, threshold, voucher_type, voucher_discount_value, voucher_validity_days, voucher_min_order')
    .eq('trigger_type', 'scan')
    .eq('is_active', true);

  if (progErr || !programs?.length) {
    return NextResponse.json({ error: 'No active check-in program' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const today = todayMYT();
  const [ty, tm, td] = today.split('-').map(Number);
  const startOfTodayMYT = new Date(Date.UTC(ty, tm - 1, td, -8, 0, 0)).toISOString();

  const { data: member, error: memberErr } = await supabase
    .from('loyalty_members')
    .upsert({ phone, updated_at: now }, { onConflict: 'phone' })
    .select('id')
    .single();

  if (memberErr || !member) {
    console.error('[checkin] member upsert error:', memberErr?.message);
    return NextResponse.json({ error: 'Could not load account' }, { status: 500 });
  }

  await issueWelcomeVoucher(member.id);

  const prog = programs[0];

  const { data: mp, error: mpErr } = await supabase
    .from('loyalty_member_programs')
    .upsert(
      { member_id: member.id, program_id: prog.id, updated_at: now },
      { onConflict: 'member_id,program_id', ignoreDuplicates: false },
    )
    .select('id, points_balance, total_earned')
    .single();

  if (mpErr || !mp) {
    console.error('[checkin] enrollment upsert error:', mpErr?.message);
    return NextResponse.json({ error: 'Could not load loyalty account' }, { status: 500 });
  }

  // Dedup: any stamp already awarded today (from QR scan or website) blocks a second one
  const { data: existingTx } = await supabase
    .from('loyalty_transactions')
    .select('id')
    .eq('member_id', member.id)
    .eq('program_id', prog.id)
    .gte('created_at', startOfTodayMYT)
    .limit(1)
    .maybeSingle();

  if (existingTx) {
    return NextResponse.json({
      already_claimed: true,
      stamp: {
        program_name:   prog.name,
        stamps_now:     mp.points_balance,
        threshold:      prog.threshold,
        voucher_issued: false,
      },
    });
  }

  const newBalance      = mp.points_balance + 1;
  const vouchersToIssue = Math.floor(newBalance / prog.threshold);
  const remainingBalance = newBalance % prog.threshold;

  await supabase.from('loyalty_member_programs').update({
    points_balance: remainingBalance,
    total_earned:   mp.total_earned + 1,
    updated_at:     now,
  }).eq('id', mp.id);

  await supabase.from('loyalty_transactions').insert({
    member_id:    member.id,
    program_id:   prog.id,
    type:         'earn_scan',
    points:       1,
    description:  'Website check-in',
    reference_id: `web:${phone}:${today}`,
    created_at:   now,
  });

  let issuedVoucher = null;
  if (vouchersToIssue > 0) {
    const code = `VCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + prog.voucher_validity_days * 86_400_000).toISOString();
    const { data } = await supabase.from('vouchers').insert({
      code,
      member_id:        member.id,
      is_active:        true,
      type:             prog.voucher_type,
      discount_value:   prog.voucher_discount_value,
      min_order_amount: prog.voucher_min_order ?? 0,
      expires_at:       expiresAt,
      times_used:       0,
      max_uses:         1,
      created_at:       now,
      reference_id:     `web:${phone}:${today}`,
    }).select('code, type, discount_value, expires_at').single();
    issuedVoucher = data;
  }

  return NextResponse.json({
    already_claimed: false,
    stamp: {
      program_name:   prog.name,
      stamps_now:     remainingBalance,
      threshold:      prog.threshold,
      voucher_issued: vouchersToIssue > 0,
      ...(issuedVoucher ? { voucher: { code: issuedVoucher.code, type: issuedVoucher.type, value: issuedVoucher.discount_value, expires_at: issuedVoucher.expires_at } } : {}),
    },
  });
}

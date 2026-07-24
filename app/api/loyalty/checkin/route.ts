import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';
import { normalisePhone, isValidMalaysianPhone } from '@/lib/normalisePhone';
import { issueWelcomeVoucher } from '@/lib/online/welcomeVoucher';
import { awardDailyCheckin } from '@/lib/online/dailyCheckin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { phone: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const phone = normalisePhone(body.phone ?? '');
  if (!isValidMalaysianPhone(phone)) {
    return NextResponse.json({ error: 'Invalid phone' }, { status: 400 });
  }

  const now = new Date().toISOString();

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

  const result = await awardDailyCheckin(member.id, phone, 'website');
  if (!result) {
    return NextResponse.json({ error: 'No active check-in program' }, { status: 404 });
  }

  return NextResponse.json({
    already_claimed: result.already_claimed,
    stamp: {
      program_name:   result.program_name,
      stamps_now:     result.stamps_now,
      threshold:      result.threshold,
      voucher_issued: result.voucher_issued,
      ...(result.voucher ? { voucher: result.voucher } : {}),
    },
  });
}

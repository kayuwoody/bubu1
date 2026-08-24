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

async function issueVoucher(memberId: string, prog: { voucher_type: string; voucher_discount_value: number }, refId: string, now: string) {
  const slugPart = refId.toUpperCase().slice(3, 9).replace(/[^A-Z0-9]/g, '');
  const code = `SP-${slugPart}-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const expiresAt = endOfDayMYT().toISOString();
  const { data } = await supabase.from('vouchers').insert({
    code,
    member_id:        memberId,
    is_active:        true,
    type:             prog.voucher_type,
    discount_value:   prog.voucher_discount_value,
    min_order_amount: 0,
    expires_at:       expiresAt,
    times_used:       0,
    max_uses:         1,
    reference_id:     refId,
    created_at:       now,
  }).select('code, type, discount_value, expires_at').single();
  return data;
}

export async function POST(req: Request) {
  let body: { slug: string; phone: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const phone = normalisePhone(body.phone ?? '');
  const slug  = (body.slug ?? '').trim().toLowerCase();

  if (!isValidMalaysianPhone(phone)) return NextResponse.json({ error: 'Please enter a valid Malaysian phone number' }, { status: 400 });
  if (!slug) return NextResponse.json({ error: 'Invalid pass' }, { status: 400 });

  const { data: pass, error: passErr } = await supabase
    .from('scan_passes')
    .select('id, name, pass_type, voucher_type, voucher_value, one_per_phone_per_day, loyalty_program_id, loyalty_programs(id, name, threshold, voucher_type, voucher_discount_value)')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (passErr || !pass) return NextResponse.json({ error: 'This offer is not available' }, { status: 404 });

  const today = todayMYT();
  const refId = `sp:${slug}:${phone}:${today}`;
  const now   = new Date().toISOString();
  // Start of today in MYT (UTC+8) expressed as UTC timestamp for range queries
  const [ty, tm, td] = today.split('-').map(Number);
  const startOfTodayMYT = new Date(Date.UTC(ty, tm - 1, td, -8, 0, 0)).toISOString();

  // ── Stamp pass ────────────────────────────────────────────────────────────
  if (pass.pass_type === 'stamp') {
    const prog = (Array.isArray(pass.loyalty_programs) ? pass.loyalty_programs[0] : pass.loyalty_programs) as { id: string; name: string; threshold: number; voucher_type: string; voucher_discount_value: number } | null;
    if (!prog) return NextResponse.json({ error: 'Stamp program not configured' }, { status: 500 });

    // Upsert loyalty member first (needed for member_id dedup check)
    const { data: member, error: memberErr } = await supabase
      .from('loyalty_members')
      .upsert({ phone, updated_at: now }, { onConflict: 'phone' })
      .select('id')
      .single();

    if (memberErr || !member) {
      console.error('[scanpass/stamp] member upsert error:', memberErr?.message);
      return NextResponse.json({ error: 'Could not find account. Please try again.' }, { status: 500 });
    }

    await issueWelcomeVoucher(member.id);

    // Upsert enrollment
    const { data: mp, error: mpErr } = await supabase
      .from('loyalty_member_programs')
      .upsert(
        { member_id: member.id, program_id: prog.id, updated_at: now },
        { onConflict: 'member_id,program_id', ignoreDuplicates: false },
      )
      .select('id, points_balance, total_earned')
      .single();

    if (mpErr || !mp) {
      console.error('[scanpass/stamp] enrollment upsert error:', mpErr?.message);
      return NextResponse.json({ error: 'Could not load loyalty account. Please try again.' }, { status: 500 });
    }

    // Dedup: check for ANY stamp on this program today — catches both scan-pass
    // and POS in-person stamps so a customer can't double-dip across sources.
    const { data: existingTx } = await supabase
      .from('loyalty_transactions')
      .select('id, type')
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

    // Award 1 stamp
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
      description:  `Check-in — ${pass.name}`,
      reference_id: refId,
      created_at:   now,
    });

    let issuedVoucher = null;
    if (vouchersToIssue > 0) {
      issuedVoucher = await issueVoucher(member.id, prog, refId, now);
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

  // ── Voucher pass (original logic) ─────────────────────────────────────────
  if (pass.one_per_phone_per_day) {
    const { data: existing } = await supabase
      .from('vouchers')
      .select('id, code, expires_at')
      .eq('reference_id', refId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        already_claimed: true,
        voucher: {
          code:       existing.code,
          type:       pass.voucher_type,
          value:      pass.voucher_value,
          expires_at: existing.expires_at,
        },
      });
    }
  }

  const slugPart = slug.toUpperCase().slice(0, 6).replace(/[^A-Z0-9]/g, '');
  const code = `SP-${slugPart}-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const expiresAt = endOfDayMYT().toISOString();

  const { data: voucher, error: vErr } = await supabase
    .from('vouchers')
    .insert({
      code,
      member_id:        null,
      is_active:        true,
      type:             pass.voucher_type,
      discount_value:   pass.voucher_value,
      min_order_amount: 0,
      expires_at:       expiresAt,
      times_used:       0,
      max_uses:         1,
      reference_id:     refId,
      created_at:       now,
    })
    .select('code, type, discount_value, expires_at')
    .single();

  if (vErr || !voucher) {
    console.error('[scanpass] voucher insert error:', vErr?.message);
    return NextResponse.json({ error: 'Could not create voucher. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({
    already_claimed: false,
    voucher: {
      code:       voucher.code,
      type:       voucher.type,
      value:      voucher.discount_value,
      expires_at: voucher.expires_at,
    },
  });
}

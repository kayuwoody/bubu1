import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

function todayMYT(): string {
  // Returns YYYY-MM-DD in Malaysia time (UTC+8)
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

function endOfDayMYT(): Date {
  // Midnight tonight MYT = next calendar day 00:00 MYT = 16:00 UTC that day
  const todayStr = todayMYT();          // e.g. "2025-05-22"
  const [y, m, d] = todayStr.split('-').map(Number);
  // Next day 00:00 MYT = next day 16:00 UTC (previous day)
  // Simpler: add 1 day to today-at-16:00 UTC
  const expiryUTC = new Date(Date.UTC(y, m - 1, d, 16, 0, 0, 0)); // today at midnight MYT
  // If we're already past midnight MYT, add 24h
  if (Date.now() > expiryUTC.getTime()) expiryUTC.setUTCDate(expiryUTC.getUTCDate() + 1);
  return expiryUTC;
}

export async function POST(req: Request) {
  let body: { slug: string; phone: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const phone = (body.phone ?? '').replace(/\D/g, '');
  const slug  = (body.slug ?? '').trim().toLowerCase();

  if (!phone || phone.length < 8) return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 });
  if (!slug) return NextResponse.json({ error: 'Invalid pass' }, { status: 400 });

  // Fetch pass config
  const { data: pass, error: passErr } = await supabase
    .from('scan_passes')
    .select('id, name, voucher_type, voucher_value, one_per_phone_per_day')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (passErr || !pass) return NextResponse.json({ error: 'This offer is not available' }, { status: 404 });

  const today = todayMYT();
  const refId = `sp:${slug}:${phone}:${today}`;

  // Deduplicate: check if already claimed today
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

  // Generate voucher code: SP-{SLUG_SHORT}-{RANDOM}
  const slugPart = slug.toUpperCase().slice(0, 6).replace(/[^A-Z0-9]/g, '');
  const code = `SP-${slugPart}-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  const expiresAt = endOfDayMYT().toISOString();
  const now = new Date().toISOString();

  const { data: voucher, error: vErr } = await supabase
    .from('vouchers')
    .insert({
      code,
      member_id:      null,
      is_active:      true,
      type:           pass.voucher_type,
      discount_value: pass.voucher_value,
      min_order_amount: null,
      expires_at:     expiresAt,
      times_used:     0,
      max_uses:       1,
      reference_id:   refId,
      created_at:     now,
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

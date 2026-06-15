import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { code?: string; order_total?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ valid: false, reason: 'Invalid request' }, { status: 400 });
  }

  const code = (body.code ?? '').trim().toUpperCase();
  const orderTotal = body.order_total ?? 0;

  if (!code) {
    return NextResponse.json({ valid: false, reason: 'Voucher code is required' });
  }

  const { data: voucher } = await supabase
    .from('vouchers')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .single();

  if (!voucher) {
    return NextResponse.json({ valid: false, reason: 'Voucher not found or inactive' });
  }

  if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: 'Voucher has expired' });
  }

  if (voucher.times_used >= voucher.max_uses) {
    return NextResponse.json({ valid: false, reason: 'Voucher has already been used' });
  }

  const minOrder = voucher.min_order_amount != null ? Number(voucher.min_order_amount) : null;
  if (minOrder != null && orderTotal < minOrder) {
    return NextResponse.json({
      valid: false,
      reason: `Minimum order of RM ${minOrder.toFixed(2)} required`,
    });
  }

  return NextResponse.json({
    valid: true,
    voucher: {
      code: voucher.code,
      discount_amount: Number(voucher.discount_value ?? voucher.discount_amount ?? voucher.amount ?? 0),
      type: voucher.type,
    },
  });
}

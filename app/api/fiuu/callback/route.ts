import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';
import { verifyFiuuCallback, isFiuuSuccess } from '@/lib/online/fiuu';
import { nextOrderNumber } from '@/lib/online/orderNumber';
import type { CartLine, CheckoutSession } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Merchant portal verifies this endpoint with GET before activating callback
export async function GET() {
  return new Response('RECEIVEROK', { status: 200 });
}

export async function POST(req: Request) {
  let body: Record<string, string>;
  let rawText = '';
  try {
    rawText = await req.text();
    body = Object.fromEntries(new URLSearchParams(rawText));
  } catch {
    console.error('[fiuu/callback] body parse failed, raw:', rawText);
    return new Response('FAILED', { status: 400 });
  }

  console.log('[fiuu/callback] received fields:', JSON.stringify(Object.keys(body)));
  console.log('[fiuu/callback] body:', JSON.stringify(body));

  // Normalise for required-field check (verifyFiuuCallback re-normalises internally)
  const tranID   = body.tranID   ?? body.TranID   ?? '';
  const rawOrder = body.orderID  ?? body.OrderID  ?? body.orderid  ?? '';
  const status   = body.status   ?? body.Status   ?? body.StatCode ?? '';
  const amount   = body.amount   ?? body.Amount   ?? '';
  const currency = body.currency ?? body.Currency ?? 'MYR';

  // Fiuu receives hyphen-free UUID; reconstruct the standard UUID format for Supabase
  const orderID = rawOrder.length === 32 && /^[0-9a-f]+$/i.test(rawOrder)
    ? `${rawOrder.slice(0,8)}-${rawOrder.slice(8,12)}-${rawOrder.slice(12,16)}-${rawOrder.slice(16,20)}-${rawOrder.slice(20)}`
    : rawOrder;

  if (!tranID || !orderID || !status) {
    console.error('[fiuu/callback] missing required fields — tranID:', tranID, 'orderID:', orderID, 'status:', status);
    return new Response('FAILED', { status: 200 });
  }

  let valid = false;
  try {
    valid = verifyFiuuCallback(body);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'sig error';
    console.error('[fiuu/callback] verify error:', msg);
    return new Response('FAILED', { status: 200 });
  }

  if (!valid) {
    console.warn('[fiuu/callback] invalid signature for tranID:', tranID);
    return new Response('FAILED', { status: 200 });
  }

  // Upsert payment record
  const { error: upsertErr } = await supabase.from('fiuu_payments').upsert({
    payment_ref:  tranID,
    order_id:     null,
    amount:       parseFloat(amount),
    currency:     currency ?? 'MYR',
    status_code:  status,
    raw_payload:  body,
  }, { onConflict: 'payment_ref' });
  if (upsertErr) console.error('[fiuu/callback] fiuu_payments upsert error:', upsertErr.message);

  if (!isFiuuSuccess(status)) {
    await supabase
      .from('checkout_sessions')
      .update({ status: 'failed' })
      .eq('id', orderID);
    return new Response('RECEIVEDFAILED', { status: 200 });
  }

  // Look up checkout session for cart + customer data
  const { data: session, error: sessionErr } = await supabase
    .from('checkout_sessions')
    .select('*')
    .eq('id', orderID)
    .single();
  console.log('[fiuu/callback] session lookup — found:', !!session, sessionErr?.message ?? '');

  if (!session) {
    console.error('[fiuu/callback] session not found:', orderID);
    return new Response('FAILED', { status: 200 });
  }

  // Idempotency: already processed
  if (session.order_id) {
    console.log('[fiuu/callback] already processed, order:', session.order_id);
    return new Response('RECEIVEROK', { status: 200 });
  }

  let orderId: string;
  try {
    orderId = await nextOrderNumber();
    console.log('[fiuu/callback] generated order number:', orderId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'order number error';
    console.error('[fiuu/callback] order number error:', msg);
    return new Response('FAILED', { status: 200 });
  }

  const now = new Date().toISOString();

  const { error: orderErr } = await supabase.from('online_orders').insert({
    id:                  orderId,
    payment_ref:         tranID,
    outlet_id:           session.outlet_id,
    status:              'pending',
    pickup_type:         session.pickup_type,
    customer_name:       session.customer_name,
    customer_phone:      session.customer_phone,
    total_paid:          session.total_amount,
    currency:            'MYR',
    created_at:          now,
    updated_at:          now,
  });

  if (orderErr) {
    console.error('[fiuu/callback] order insert error:', orderErr.message);
    return new Response('FAILED', { status: 200 });
  }
  console.log('[fiuu/callback] online_orders inserted:', orderId);

  const items: CartLine[] = session.items ?? [];

  const { error: itemsErr } = await supabase.from('online_order_items').insert(
    items.map((line) => ({
      order_id:     orderId,
      product_id:   line.id,
      product_name: line.name ?? line.id,
      qty:          line.qty,
      unit_price:   line.unitPrice,
      mods:         line.mods ?? {},
    }))
  );
  if (itemsErr) console.error('[fiuu/callback] order items error:', itemsErr.message);

  // Update payment + session records
  const [{ error: payErr }, { data: sessData, error: sessErr }] = await Promise.all([
    supabase.from('fiuu_payments').update({ order_id: orderId }).eq('payment_ref', tranID),
    supabase.from('checkout_sessions')
      .update({ status: 'paid', order_id: orderId })
      .eq('id', orderID)
      .select('id, status, order_id'),
  ]);
  if (payErr)  console.error('[fiuu/callback] fiuu_payments update error:', payErr.message);
  if (sessErr) console.error('[fiuu/callback] checkout_sessions update error:', sessErr.message);
  console.log('[fiuu/callback] done — order:', orderId, 'session rows updated:', sessData?.length ?? 0);

  // Award loyalty points — non-blocking, never fails the callback
  try { await awardLoyaltyPoints(session, orderId, now); }
  catch (e: unknown) { console.error('[loyalty] uncaught error:', e instanceof Error ? e.message : e); }

  // Increment voucher usage if one was applied — non-blocking
  if (session.voucher_code) {
    try { await incrementVoucherUsage(session.voucher_code); }
    catch (e: unknown) { console.error('[voucher] uncaught error:', e instanceof Error ? e.message : e); }
  }

  return new Response('RECEIVEROK', { status: 200 });
}

async function incrementVoucherUsage(voucherCode: string) {
  const { error } = await supabase.rpc('increment_voucher_usage', { voucher_code: voucherCode });
  if (error) {
    // Fallback: manual increment if RPC doesn't exist yet
    console.warn('[voucher] RPC failed, trying manual increment:', error.message);
    const { data: v } = await supabase.from('vouchers').select('times_used').eq('code', voucherCode).single();
    if (v) {
      await supabase.from('vouchers').update({ times_used: v.times_used + 1 }).eq('code', voucherCode);
    }
  } else {
    console.log('[voucher] incremented usage for:', voucherCode);
  }
}

async function awardLoyaltyPoints(
  session: CheckoutSession,
  orderId: string,
  now: string,
) {
  console.log('[loyalty] start — phone:', session.customer_phone, 'amount:', session.total_amount, 'order:', orderId);

  const { data: config, error: configErr } = await supabase
    .from('loyalty_config')
    .select('is_active, points_per_scan, min_order_for_voucher')
    .eq('id', 'main')
    .single();

  if (configErr || !config) {
    console.warn('[loyalty] no loyalty_config row with id=main — skipping');
    return;
  }
  if (!config.is_active) { console.log('[loyalty] loyalty disabled'); return; }
  if (config.min_order_for_voucher != null && session.total_amount < config.min_order_for_voucher) {
    console.log('[loyalty] below min order:', session.total_amount, '<', config.min_order_for_voucher);
  }

  const phone = session.customer_phone.replace(/\D/g, '');
  if (!phone) { console.warn('[loyalty] empty phone after stripping, skipping'); return; }

  // Upsert loyalty member
  const { data: member, error: memberErr } = await supabase
    .from('loyalty_members')
    .upsert(
      { phone, name: session.customer_name || null, updated_at: now },
      { onConflict: 'phone' },
    )
    .select('id, points_balance, total_points_earned')
    .single();

  if (memberErr || !member) {
    console.error('[loyalty] member upsert error:', memberErr?.message);
    return;
  }

  // Record transaction (1 point per order)
  const points = 1;
  const { error: txErr } = await supabase.from('loyalty_transactions').insert({
    member_id:    member.id,
    type:         'earn_order',
    points,
    description:  `Order ${orderId}`,
    reference_id: orderId,
    created_at:   now,
  });
  if (txErr) { console.error('[loyalty] transaction insert error:', txErr.message); return; }

  const { error: balErr } = await supabase
    .from('loyalty_members')
    .update({
      points_balance:      member.points_balance + points,
      total_points_earned: member.total_points_earned + points,
      updated_at:          now,
    })
    .eq('id', member.id);
  if (balErr) console.error('[loyalty] balance update error:', balErr.message);
  else console.log('[loyalty] awarded', points, 'pt → member:', member.id, 'order:', orderId);
}

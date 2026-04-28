import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';
import { verifyFiuuCallback, isFiuuSuccess } from '@/lib/online/fiuu';
import { nextOrderNumber } from '@/lib/online/orderNumber';
import type { CartLine } from '@/lib/types';

export const dynamic = 'force-dynamic';

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

  // Fiuu field names vary by integration version — normalise both cases
  const tranID   = body.tranID   ?? body.TranID   ?? '';
  const orderID  = body.orderID  ?? body.OrderID  ?? body.orderid  ?? '';
  const status   = body.status   ?? body.Status   ?? body.StatCode ?? '';
  const amount   = body.amount   ?? body.Amount   ?? '';
  const currency = body.currency ?? body.Currency ?? 'MYR';

  if (!tranID || !orderID || !status) {
    console.error('[fiuu/callback] missing required fields — tranID:', tranID, 'orderID:', orderID, 'status:', status);
    return new Response('FAILED', { status: 400 });
  }

  // Verify using raw body keys so the hash matches exactly what Fiuu signed
  const verifyBody = { ...body, tranID, orderID, status, amount, currency };
  let valid = false;
  try {
    valid = verifyFiuuCallback(verifyBody);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'sig error';
    console.error('[fiuu/callback] verify error:', msg);
    return new Response('FAILED', { status: 500 });
  }

  if (!valid) {
    console.warn('[fiuu/callback] invalid signature for tranID:', tranID);
    return new Response('FAILED', { status: 400 });
  }

  // Upsert payment record
  await supabase.from('fiuu_payments').upsert({
    payment_ref:  tranID,
    order_id:     null,
    amount:       parseFloat(amount),
    currency:     currency ?? 'MYR',
    status_code:  status,
    raw_payload:  body,
  }, { onConflict: 'payment_ref' });

  if (!isFiuuSuccess(status)) {
    await supabase
      .from('checkout_sessions')
      .update({ status: 'failed' })
      .eq('id', orderID);
    return new Response('RECEIVEDFAILED', { status: 200 });
  }

  // Look up checkout session for cart + customer data
  const { data: session } = await supabase
    .from('checkout_sessions')
    .select('*')
    .eq('id', orderID)
    .single();

  if (!session) {
    console.error('[fiuu/callback] session not found:', orderID);
    return new Response('FAILED', { status: 404 });
  }

  // Idempotency: already processed
  if (session.order_id) {
    return new Response('RECEIVEROK', { status: 200 });
  }

  let orderId: string;
  try {
    orderId = await nextOrderNumber();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'order number error';
    console.error('[fiuu/callback] order number error:', msg);
    return new Response('FAILED', { status: 500 });
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
    currency:            session.currency,
    created_at:          now,
    updated_at:          now,
  });

  if (orderErr) {
    console.error('[fiuu/callback] order insert error:', orderErr.message);
    return new Response('FAILED', { status: 500 });
  }

  const items: CartLine[] = session.items ?? [];
  const productIds = items.map((i) => i.id);
  const { data: catalogue } = await supabase
    .from('online_products')
    .select('id, name')
    .in('id', productIds);
  const nameMap = Object.fromEntries((catalogue ?? []).map((p) => [p.id, p.name]));

  await supabase.from('online_order_items').insert(
    items.map((line) => ({
      order_id:     orderId,
      product_id:   line.id,
      product_name: nameMap[line.id] ?? line.id,
      qty:          line.qty,
      unit_price:   line.unitPrice,
      mods:         line.mods ?? {},
    }))
  );

  // Update payment + session records
  await Promise.all([
    supabase.from('fiuu_payments').update({ order_id: orderId }).eq('payment_ref', tranID),
    supabase.from('checkout_sessions').update({ status: 'paid', order_id: orderId }).eq('id', orderID),
  ]);

  return new Response('RECEIVEROK', { status: 200 });
}

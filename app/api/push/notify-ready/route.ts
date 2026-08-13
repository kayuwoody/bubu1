import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';
import { normalisePhone } from '@/lib/normalisePhone';
import { ensureVapid, sendPush } from '@/lib/online/push';

export const dynamic = 'force-dynamic';

// Supabase Database Webhook target: online_orders UPDATE.
// Guardrails: (1) shared-secret auth, (2) fire only on the ready transition,
// (3) atomic idempotency so a customer never gets two "ready" pushes.
export async function POST(req: Request) {
  // (3a) auth — shared secret header set on the Supabase webhook
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    type?: string;
    record?: { id?: string; status?: string; customer_phone?: string };
    old_record?: { status?: string };
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const rec = body.record;
  const oldStatus = body.old_record?.status;

  // (2) only the transition INTO 'ready' — ignore accept/reject/collect and
  // any later touch of an already-ready row.
  if (!rec?.id || rec.status !== 'ready' || oldStatus === 'ready') {
    return NextResponse.json({ ok: true, skipped: 'not a ready transition' });
  }

  const now = new Date().toISOString();

  // (3b) atomic idempotency claim — only the first caller to flip
  // ready_notified_at from NULL proceeds to send.
  const { data: claimed } = await supabase
    .from('online_orders')
    .update({ ready_notified_at: now })
    .eq('id', rec.id)
    .is('ready_notified_at', null)
    .select('id');
  if (!claimed?.length) {
    return NextResponse.json({ ok: true, skipped: 'already notified' });
  }

  const phone = normalisePhone(rec.customer_phone ?? '');
  if (!phone) return NextResponse.json({ ok: true, skipped: 'no phone' });

  if (!ensureVapid()) {
    console.warn('[push/notify-ready] VAPID not configured');
    return NextResponse.json({ ok: true, skipped: 'vapid not configured' });
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('phone', phone);

  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 });

  const payload = {
    title: '☕ Your order is ready!',
    body:  `Order ${rec.id} is ready for pickup.`,
    url:   `/order/${rec.id}`,
    tag:   `order-${rec.id}`,
  };

  let sent = 0;
  const dead: string[] = [];
  for (const sub of subs) {
    const result = await sendPush(sub, payload);
    if (result === 'ok') sent++;
    else if (result === 'gone') dead.push(sub.endpoint);
  }

  // Prune expired subscriptions
  if (dead.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', dead);
  }

  return NextResponse.json({ ok: true, sent, pruned: dead.length });
}

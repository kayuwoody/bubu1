import { NextResponse } from 'next/server';
import { ensureVapid, sendPush } from '@/lib/online/push';

export const dynamic = 'force-dynamic';

// TEMPORARY test hook — sends a push to the caller's OWN subscription only.
// Lets you verify the full path (VAPID → push service → SW → notification)
// without waiting on a real order. Remove before/after launch.
export async function POST(req: Request) {
  let body: { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  if (!ensureVapid()) {
    return NextResponse.json({ error: 'Push not configured (VAPID keys missing)' }, { status: 503 });
  }

  const result = await sendPush(
    { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    { title: '☕ Test notification', body: 'Push is working! You’ll get one of these when an order is ready.', url: '/', tag: 'test' },
  );

  if (result === 'ok') return NextResponse.json({ ok: true });
  return NextResponse.json({ error: `Send failed (${result})` }, { status: 500 });
}

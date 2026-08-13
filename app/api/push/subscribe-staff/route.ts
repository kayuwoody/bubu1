import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

// Registers a device as a STAFF subscriber (receives new-order alerts).
// Gated by STAFF_PASSCODE so only the merchant can enrol their phone.
export async function POST(req: Request) {
  let body: { passcode?: string; subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const expected = process.env.STAFF_PASSCODE;
  if (!expected || body.passcode !== expected) {
    return NextResponse.json({ error: 'Incorrect passcode' }, { status: 401 });
  }

  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    phone:      null,
    role:       'staff',
    endpoint:   sub.endpoint,
    p256dh:     sub.keys.p256dh,
    auth:       sub.keys.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });

  if (error) {
    console.error('[push/subscribe-staff] error:', error.message);
    return NextResponse.json({ error: 'Could not save subscription' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

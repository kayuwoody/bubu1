import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';
import { normalisePhone } from '@/lib/normalisePhone';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { phone?: string; subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const phone = normalisePhone(body.phone ?? '');
  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    phone,
    endpoint:   sub.endpoint,
    p256dh:     sub.keys.p256dh,
    auth:       sub.keys.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });

  if (error) {
    console.error('[push/subscribe] error:', error.message);
    return NextResponse.json({ error: 'Could not save subscription' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

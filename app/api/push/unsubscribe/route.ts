import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { endpoint?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  if (!body.endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });

  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', body.endpoint);
  if (error) {
    console.error('[push/unsubscribe] error:', error.message);
    return NextResponse.json({ error: 'Could not remove subscription' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

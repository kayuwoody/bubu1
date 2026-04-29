import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';
import { buildFiuuSeamlessAttrs } from '@/lib/online/fiuu';
import type { CartLine } from '@/lib/types';

export const dynamic = 'force-dynamic';

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function POST(req: Request) {
  let body: {
    name: string;
    email: string;
    phone: string;
    pickup: 'counter' | 'curbside';
    items: CartLine[];
    total: number;
    channel?: string;
    outlet_id?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, email, phone, pickup, items, total, channel, outlet_id = 'main' } = body;

  if (!name || !phone || !items?.length || total == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data: settings } = await supabase
    .from('outlet_settings')
    .select('intake_paused')
    .eq('outlet_id', outlet_id)
    .single();

  if (settings?.intake_paused) {
    return NextResponse.json(
      { error: 'Online ordering is temporarily paused. Please try again shortly.' },
      { status: 503 }
    );
  }

  const { data: session, error: sessionErr } = await supabase
    .from('checkout_sessions')
    .insert({
      customer_name:  name,
      customer_email: email ?? '',
      customer_phone: phone,
      pickup_type:    pickup,
      items,
      total_amount:   total,
      outlet_id,
      status: 'pending',
    })
    .select('id')
    .single();

  if (sessionErr || !session) {
    console.error('[POST /api/checkout] session error:', sessionErr?.message);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }

  // Fetch mpslinkkey server-side to avoid CORS blocking in browser
  let linkKey = '';
  try {
    const fiuuBase = process.env.FIUU_BASE_URL ?? 'https://pay.fiuu.com';
    const merchantId = process.env.FIUU_MERCHANT_ID ?? '';
    const vres = await fetch(`${fiuuBase}/RMS/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `mpsmerchantid=${encodeURIComponent(merchantId)}`,
    });
    const vtext = await vres.text();
    console.log('[checkout] verify raw response:', vtext.slice(0, 300));
    try {
      const vj = JSON.parse(vtext);
      linkKey = vj.linkkey ?? vj.mpslinkkey ?? vj.link_key ?? '';
    } catch {
      const vp = new URLSearchParams(vtext);
      linkKey = vp.get('linkkey') ?? vp.get('mpslinkkey') ?? '';
    }
    console.log('[checkout] linkKey:', linkKey ? linkKey.slice(0, 8) + '…' : 'EMPTY');
  } catch (e) {
    console.warn('[checkout] verify fetch failed:', e instanceof Error ? e.message : e);
  }

  let fiuu: { scriptUrl: string; attrs: Record<string, string> };
  try {
    fiuu = buildFiuuSeamlessAttrs({
      sessionId:     session.id,
      amount:        total,
      baseUrl:       getBaseUrl(),
      channel,
      customerName:  name,
      customerEmail: email ?? '',
      customerPhone: phone,
      linkKey,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ sessionId: session.id, fiuuScriptUrl: fiuu.scriptUrl, fiuuAttrs: fiuu.attrs, fiuuVerifyUrl: '/api/fiuu/verify' });
}

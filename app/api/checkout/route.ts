import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';
import { buildFiuuPaymentData } from '@/lib/online/fiuu';
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
    outlet_id?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, email, phone, pickup, items, total, outlet_id = 'main' } = body;

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

  let fiuu: { url: string; params: Record<string, string> };
  try {
    fiuu = buildFiuuPaymentData({
      sessionId:     session.id,
      amount:        total,
      baseUrl:       getBaseUrl(),
      customerName:  name,
      customerEmail: email ?? '',
      customerPhone: phone,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ sessionId: session.id, fiuuUrl: fiuu.url, fiuuParams: fiuu.params });
}

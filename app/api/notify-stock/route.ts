import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';
import { normalisePhone } from '@/lib/normalisePhone';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { product_id?: string; product_name?: string; phone?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { product_id, product_name, email } = body;
  const phone = body.phone ? normalisePhone(body.phone) : undefined;

  if (!product_id || !product_name) {
    return NextResponse.json({ error: 'product_id and product_name are required' }, { status: 400 });
  }

  if (!email && !phone) {
    return NextResponse.json({ error: 'At least one of email or phone is required' }, { status: 400 });
  }

  // Deduplication check
  if (email) {
    const { data: existing } = await supabase
      .from('stock_notifications')
      .select('id')
      .eq('product_id', product_id)
      .eq('email', email)
      .maybeSingle();
    if (existing) return NextResponse.json({ ok: true, already: true });
  } else if (phone) {
    const { data: existing } = await supabase
      .from('stock_notifications')
      .select('id')
      .eq('product_id', product_id)
      .eq('phone', phone)
      .is('email', null)
      .maybeSingle();
    if (existing) return NextResponse.json({ ok: true, already: true });
  }

  const { error } = await supabase.from('stock_notifications').insert({
    product_id,
    product_name,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  });

  if (error) {
    // Conflict / duplicate — treat as success
    if (error.code === '23505') return NextResponse.json({ ok: true, already: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

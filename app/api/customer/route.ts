import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = (searchParams.get('phone') ?? '').replace(/\D/g, '');
  if (phone.length < 8) return NextResponse.json(null);

  const { data } = await supabase
    .from('customers')
    .select('id, phone, name, points_balance, credit_balance')
    .eq('phone', phone)
    .single();

  return NextResponse.json(data ?? null);
}

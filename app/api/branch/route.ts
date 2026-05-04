import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data } = await supabase
    .from('branches')
    .select('id, name, code, address, phone, is_active')
    .eq('is_active', true)
    .limit(1)
    .single();

  return NextResponse.json(data ?? null);
}

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data: config } = await supabase
    .from('loyalty_config')
    .select('*')
    .eq('id', 'main')
    .single();

  return NextResponse.json({ config: config ?? null });
}

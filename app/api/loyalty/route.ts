import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data: config, error } = await supabase
    .from('loyalty_config')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error) console.error('[loyalty] config fetch error:', error.message, error.code);

  return NextResponse.json({ config: config ?? null });
}

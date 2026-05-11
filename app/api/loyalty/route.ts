import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data: programs, error } = await supabase
    .from('loyalty_programs')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) console.error('[loyalty] programs fetch error:', error.message, error.code);

  // For backward compat, also expose the first scan program as `config`
  const config = programs?.find(p => p.trigger_type === 'scan') ?? null;

  return NextResponse.json({ programs: programs ?? [], config });
}

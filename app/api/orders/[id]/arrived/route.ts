import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await supabase
    .from('online_orders')
    .update({ arrived_at: new Date().toISOString() })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

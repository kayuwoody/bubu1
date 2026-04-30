import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;

  const { data, error } = await supabase
    .from('checkout_sessions')
    .select('id, status, order_id')
    .eq('id', sessionId)
    .single();

  console.log('[checkout/poll] sessionId:', sessionId, 'data:', JSON.stringify(data), 'error:', error?.message);

  if (error || !data) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: data.id,
    status:    data.status,
    order_id:  data.order_id ?? null,
  });
}

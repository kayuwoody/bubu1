import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const enrollment_id = searchParams.get('enrollment_id') ?? '';
  if (!enrollment_id) return NextResponse.json({ usage: [] });

  const { data, error } = await supabase
    .from('member_pass_usage')
    .select('*')
    .eq('enrollment_id', enrollment_id)
    .order('used_at', { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ usage: [] });
  return NextResponse.json({ usage: data ?? [] });
}

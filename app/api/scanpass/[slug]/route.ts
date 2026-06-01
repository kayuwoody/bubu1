import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const { data, error } = await supabase
    .from('scan_passes')
    .select('id, slug, name, description, image_url, voucher_type, voucher_value, is_active, one_per_phone_per_day, pass_type, loyalty_program_id, loyalty_programs(id, name, threshold, voucher_type, voucher_discount_value)')
    .eq('slug', params.slug)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Pass not found' }, { status: 404 });
  if (!data.is_active) return NextResponse.json({ error: 'This offer is no longer active' }, { status: 410 });

  return NextResponse.json({ pass: data });
}

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('promotions')
    .select('id, title, subtitle, body, image_url, cta_text, cta_url, bg_color, text_color')
    .eq('is_active', true)
    .or(`valid_from.is.null,valid_from.lte.${now}`)
    .or(`valid_until.is.null,valid_until.gte.${now}`)
    .order('sort_order', { ascending: true });

  if (error) {
    // Table may not exist yet — fail silently
    console.warn('[promotions] fetch error:', error.message);
    return NextResponse.json({ promotions: [] });
  }

  return NextResponse.json({ promotions: data ?? [] });
}

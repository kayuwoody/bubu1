import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const program_id = searchParams.get('program_id') ?? '';
  if (!program_id) return NextResponse.json({ products: [] });

  const { data, error } = await supabase
    .from('loyalty_program_products')
    .select('product_id, products(name)')
    .eq('program_id', program_id);

  if (error) return NextResponse.json({ products: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products = (data ?? []).map((row: any) => ({
    product_id: row.product_id as string,
    product_name: (Array.isArray(row.products) ? row.products[0]?.name : row.products?.name) ?? null,
  }));

  return NextResponse.json({ products });
}

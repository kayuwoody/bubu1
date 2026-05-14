import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [productsRes, settingsRes, branchRes, catsRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, category, base_price, image_url, combo_price_override, selection_config, available_online, stock_quantity')
      .eq('available_online', true)
      .order('category')
      .order('name'),
    supabase
      .from('outlet_settings')
      .select('intake_paused')
      .eq('outlet_id', 'main')
      .single(),
    supabase
      .from('branches')
      .select('id, name, code, address, phone, is_active')
      .eq('is_active', true)
      .limit(1)
      .single(),
    supabase
      .from('product_categories')
      .select('id, label, sort_order')
      .eq('is_private', false)
      .order('sort_order'),
  ]);

  // Build ordered category list from the table (only non-private rows)
  const dbCats = catsRes.data ?? [];
  const catOrder = dbCats.map(c => c.id as string);
  const catLabels = Object.fromEntries(dbCats.map(c => [c.id, c.label as string]));

  const allProducts = productsRes.data ?? [];
  const products = allProducts.filter(p => catOrder.includes(p.category));

  const categories = catOrder
    .filter(cat => products.some(p => p.category === cat))
    .map(cat => ({ id: cat, label: catLabels[cat] ?? cat }));

  return NextResponse.json({
    categories,
    products,
    intake_paused: settingsRes.data?.intake_paused ?? false,
    branch: branchRes.data ?? null,
  });
}

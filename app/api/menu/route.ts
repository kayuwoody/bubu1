import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [productsRes, settingsRes, branchRes, catsRes, defaultsRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, category, base_price, image_url, combo_price_override, selection_config, available_online, stock_quantity, sort_order')
      .eq('available_online', true)
      .order('category')
      .order('sort_order')
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
    supabase
      .from('product_recipe_items')
      .select('product_id, selection_group, linked_product_name, linked_product_id')
      .eq('is_default', true),
  ]);

  // Build ordered category list from the table (only non-private rows)
  const dbCats = catsRes.data ?? [];
  const catOrder = dbCats.map(c => c.id as string);
  const catLabels = Object.fromEntries(dbCats.map(c => [c.id, c.label as string]));

  // Group default recipe items by product_id
  const modDefaultsByProduct: Record<string, { group: string; name: string; linked_product_id: string | null }[]> = {};
  for (const row of defaultsRes.data ?? []) {
    if (!row.selection_group && !row.linked_product_id) continue;
    if (!modDefaultsByProduct[row.product_id]) modDefaultsByProduct[row.product_id] = [];
    modDefaultsByProduct[row.product_id].push({ group: row.selection_group, name: row.linked_product_name, linked_product_id: row.linked_product_id ?? null });
  }

  const allProducts = productsRes.data ?? [];
  const products = allProducts
    .filter(p => catOrder.includes(p.category))
    .map(p => ({ ...p, mod_defaults: modDefaultsByProduct[p.id] ?? [] }));

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

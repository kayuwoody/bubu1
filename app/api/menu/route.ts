import { NextResponse } from 'next/server';
import { supabase } from '@/lib/online/supabase';

export const dynamic = 'force-dynamic';

const CAT_ORDER = ['coffee', 'non-coffee', 'cold', 'food', 'combo'];
const CAT_LABELS: Record<string, string> = {
  coffee:       'Coffee',
  'non-coffee': 'Non-Coffee',
  cold:         'Iced & Frappe',
  food:         'Bakes',
  combo:        'Combos',
};

export async function GET() {
  const [productsRes, recipeRes, settingsRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, category, base_price, image_url, combo_price_override, available_online')
      .eq('available_online', true)
      .order('category')
      .order('name'),
    supabase
      .from('product_recipe_items')
      .select('id, product_id, item_type, linked_product_id, linked_product_name, quantity, is_optional, selection_group, price_adjustment, sort_order')
      .eq('item_type', 'product')
      .order('product_id')
      .order('sort_order'),
    supabase
      .from('outlet_settings')
      .select('intake_paused')
      .eq('outlet_id', 'main')
      .single(),
  ]);

  const products = productsRes.data ?? [];
  const recipeItems = recipeRes.data ?? [];

  const recipeByProduct = new Map<string, typeof recipeItems>();
  for (const item of recipeItems) {
    const arr = recipeByProduct.get(item.product_id) ?? [];
    arr.push(item);
    recipeByProduct.set(item.product_id, arr);
  }

  const seenCats = new Set<string>();
  const categories: Array<{ id: string; label: string }> = [];
  for (const cat of CAT_ORDER) {
    if (products.some(p => p.category === cat)) {
      seenCats.add(cat);
      categories.push({ id: cat, label: CAT_LABELS[cat] ?? cat });
    }
  }
  for (const p of products) {
    if (!seenCats.has(p.category) && p.category !== 'uncategorized') {
      seenCats.add(p.category);
      categories.push({ id: p.category, label: p.category });
    }
  }

  const enriched = products.map(p => ({
    ...p,
    recipe_items: recipeByProduct.get(p.id) ?? [],
  }));

  return NextResponse.json({
    categories,
    products: enriched,
    intake_paused: settingsRes.data?.intake_paused ?? false,
  });
}

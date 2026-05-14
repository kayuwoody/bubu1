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
  const [productsRes, settingsRes, branchRes] = await Promise.all([
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
  ]);

  const allProducts = productsRes.data ?? [];
  const products = allProducts.filter(p => CAT_ORDER.includes(p.category));

  const seenCats = new Set<string>();
  const categories: Array<{ id: string; label: string }> = [];
  for (const cat of CAT_ORDER) {
    if (products.some(p => p.category === cat)) {
      seenCats.add(cat);
      categories.push({ id: cat, label: CAT_LABELS[cat] ?? cat });
    }
  }

  return NextResponse.json({
    categories,
    products,
    intake_paused: settingsRes.data?.intake_paused ?? false,
    branch: branchRes.data ?? null,
  });
}

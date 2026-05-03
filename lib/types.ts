export interface MenuItem {
  id: string;
  cat: string;
  name: string;
  desc: string;
  price: number;
  tag: string | null;
  swatch: string;
}

export interface Category {
  id: string;
  label: string;
}

export interface ModOption {
  id: string;
  label: string;
  delta?: number;
}

export interface Modifier {
  label: string;
  required?: boolean;
  options: ModOption[];
  coldOnly?: boolean;
}

export interface NotesModifier {
  label: string;
  kind: 'freeform';
  placeholder: string;
}

export interface Modifiers {
  size: Modifier;
  milk: Modifier;
  sugar: Modifier;
  ice: Modifier;
  notes: NotesModifier;
}

export interface LastOrderItem {
  id: string;
  qty: number;
  mods?: Partial<ItemMods>;
}

export interface LastOrder {
  when: string;
  items: LastOrderItem[];
}

export interface Loyalty {
  program: string;
  goal: number;
  current: number;
  reward: string;
}

export interface MenuData {
  categories: Category[];
  items: MenuItem[];
  drinkCats: string[];
  modifiers: Modifiers;
  lastOrder: LastOrder;
  loyalty: Loyalty;
}

export interface ItemMods {
  size: string;
  milk: string;
  sugar: string;
  ice: string;
  notes: string;
}

export interface CartLine {
  lid: string;
  id: string;
  name: string;
  qty: number;
  mods: Record<string, unknown> | null;
  unitPrice: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  base_price: number;
  image_url: string | null;
  combo_price_override: number | null;
  available_online: boolean;
  recipe_items: RecipeItem[];
}

export interface RecipeItem {
  id: string;
  product_id: string;
  item_type: string;
  linked_product_id: string | null;
  linked_product_name: string | null;
  quantity: number;
  is_optional: boolean;
  selection_group: string | null;
  price_adjustment: number;
  sort_order: number;
}

export type Viewport = 'mobile' | 'tablet' | 'desktop';

export interface CheckoutPayload {
  name: string;
  email: string;
  phone: string;
  pickup: 'counter' | 'curbside';
  items: CartLine[];
  total: number;
}

export interface CheckoutSession {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  pickup_type: string;
  items: CartLine[];
  total_amount: number;
  outlet_id: string;
  order_id: string | null;
  status: 'pending' | 'paid' | 'failed';
  created_at: string;
}

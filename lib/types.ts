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

export interface XorGroupItem {
  id: string;
  name: string;
  basePrice: number;
  priceAdjustment: number;
}

export interface XorGroup {
  uniqueKey: string;
  displayName: string;
  parentProductId?: string;
  parentProductName?: string;
  groupName: string;
  items: XorGroupItem[];
}

export interface OptionalItem {
  id: string;
  name: string;
  basePrice: number;
  priceAdjustment: number;
  parentProductId?: string;
}

export interface SelectionConfig {
  xorGroups: XorGroup[];
  optionalItems: OptionalItem[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  base_price: number;
  image_url: string | null;
  combo_price_override: number | null;
  selection_config: SelectionConfig | null;
  available_online: boolean;
  in_stock: boolean;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
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

export interface Customer {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  points_balance: number;
  credit_balance: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltySettings {
  id: string;
  points_per_rm: number;
  min_spend_for_points: number;
  is_active: boolean;
  updated_at: string;
}

export interface LoyaltyRedemption {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  reward_type: 'free_item' | 'discount_percent' | 'discount_fixed' | 'credit';
  reward_value: number;
  reward_item_id: string | null;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  sort_order: number;
  created_at: string;
}

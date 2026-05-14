# POS ↔ Customer App Integration Guide

This document describes how the POS backend (ren1) and customer-facing app (bubu1) communicate via the shared Supabase database. Both apps talk directly to Supabase — no API calls between them.

---

## Architecture Overview

```
Customer app (bubu1.vercel.app)              POS app (ren1 / this repo)
───────────────────────────────              ────────────────────────────
Customer browses menu from Supabase          Staff manage products in local SQLite
  → reads `products` + `product_recipe_items`  → auto-syncs to Supabase on every change
  → shows combos, selection groups, prices     → also syncs on POS startup
Customer places order & pays via Fiuu        Staff see orders on Kanban board
  → callback writes to Supabase                ← Supabase Realtime subscription
  → online_orders + online_order_items         Staff accept / reject / ready / collect
  → customer order page subscribes       ←──── Status changes written to Supabase
     via Supabase Realtime                     Customer sees change instantly
```

No API calls between the two apps. Both talk directly to the same Supabase project.

---

## 1. Product Catalog (Menu)

### Source of Truth

POS SQLite is the source of truth for all product data. Products auto-sync to Supabase in two ways:

1. **Auto-sync hooks** — Every product create/update/delete and every recipe change fires a fire-and-forget sync to Supabase
2. **Startup sync** — On POS boot, all products and recipes are pushed to Supabase to catch anything missed

Staff can also trigger a full sync manually from the admin dashboard.

### Supabase Tables

#### `products`
```sql
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,                    -- UUID from POS (e.g. "a1b2c3d4-...")
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'uncategorized',
  base_price NUMERIC NOT NULL DEFAULT 0,  -- retail price in RM
  image_url TEXT,
  combo_price_override NUMERIC,           -- if set, overrides calculated combo price
  selection_config JSONB,                 -- pre-flattened XOR groups + optional items (see below)
  stock_quantity NUMERIC,                 -- current stock level (null = untracked, 0 = out of stock)
  available_online BOOLEAN DEFAULT true,  -- staff can toggle off to hide from customer menu
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `product_recipe_items`
```sql
CREATE TABLE IF NOT EXISTS product_recipe_items (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'material',  -- 'material' or 'product'
  linked_product_id TEXT REFERENCES products(id),
  linked_product_name TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'unit',
  is_optional BOOLEAN DEFAULT false,
  selection_group TEXT,                    -- XOR group name (e.g. "Choose Drink")
  price_adjustment NUMERIC DEFAULT 0,     -- e.g. +2.00 for iced upgrade
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_recipe_product ON product_recipe_items(product_id);
CREATE INDEX IF NOT EXISTS idx_recipe_linked ON product_recipe_items(linked_product_id);
```

### How to Fetch the Menu

```typescript
const { data: products } = await supabase
  .from('products')
  .select('*')
  .eq('available_online', true)
  .order('category', { ascending: true })
  .order('name', { ascending: true });
```

### Identifying Coffee Products (Milk/Sugar Options)

Use the `category` field on the `products` table to determine if a standalone product is a coffee:

```typescript
const isCoffee = product.category === 'coffee';
// If true, show milk/sugar customization options
```

For **combo selections**, you do NOT need to query the product's category separately. Each item inside `selection_config` already has an `isCoffee` boolean pre-computed by the POS:

```typescript
// Standalone product:
product.category === 'coffee'  // ← use this

// Inside a combo's selection_config:
item.isCoffee                  // ← already provided, no extra query needed
```

**No separate `is_coffee` column is needed** on the Supabase `products` table — the information is already available via `category` for standalone products and via `isCoffee` inside `selection_config` for combo items.

### Combos, Bundles & Selection Config

A product is a combo/bundle if it has a non-null `selection_config` field. This JSONB column contains a **pre-flattened** view of all selection groups and optional items, including nested choices — no recursive queries needed.

#### Checking if a product needs a selection modal

```typescript
const needsModal = product.selection_config != null;
```

#### `selection_config` Structure

```typescript
interface SelectionConfig {
  xorGroups: Array<{
    uniqueKey: string;          // e.g. "root:Drink" or "americano-uuid:Temp"
    displayName: string;        // e.g. "Choose Drink" or "Dark Mane Americano Temp"
    parentProductId?: string;   // set for nested groups (links to parent item's ID)
    parentProductName?: string;
    groupName: string;          // original group name
    items: Array<{
      id: string;               // product UUID
      name: string;
      basePrice: number;
      priceAdjustment: number;  // extra charge on top of combo override
      isCoffee: boolean;        // true if product category is 'coffee' — show milk/sugar options
    }>;
  }>;
  optionalItems: Array<{
    id: string;                 // product UUID
    name: string;
    basePrice: number;
    priceAdjustment: number;
    isCoffee: boolean;          // true if product category is 'coffee' — show milk/sugar options
    parentProductId?: string;
    parentProductName?: string;
  }>;
}
```

#### Example: "Coffee & Danish Combo"

This combo has 6 drink options (some are coffee with Hot/Iced choices, some are tea with no temperature choice), 5 danish options, and 1 optional milk upgrade. The `selection_config` is pre-flattened — every XOR group from every nesting level appears in a single flat array.

```json
{
  "xorGroups": [
    {
      "uniqueKey": "root:Drink",
      "displayName": "Drink",
      "groupName": "Drink",
      "items": [
        { "id": "product-337", "name": "Dark Mane Americano", "basePrice": 8.50, "priceAdjustment": 0, "isCoffee": true },
        { "id": "product-336", "name": "Velvety Cloud Latte", "basePrice": 11.00, "priceAdjustment": 1.60, "isCoffee": true },
        { "id": "product-292", "name": "Cappu-corniccino", "basePrice": 10.50, "priceAdjustment": 1.50, "isCoffee": true },
        { "id": "product-335", "name": "Choco Horn Mocha", "basePrice": 12.00, "priceAdjustment": 2.50, "isCoffee": true },
        { "id": "product-250", "name": "Iced Peach Tea", "basePrice": 7.00, "priceAdjustment": 0, "isCoffee": false },
        { "id": "product-252", "name": "Iced Apple Tea", "basePrice": 7.50, "priceAdjustment": 0, "isCoffee": false }
      ]
    },
    {
      "uniqueKey": "product-337:Temp",
      "displayName": "Dark Mane Americano Temp",
      "parentProductId": "product-337",
      "parentProductName": "Dark Mane Americano",
      "groupName": "Temp",
      "items": [
        { "id": "hot-americano-uuid", "name": "Hot", "basePrice": 0, "priceAdjustment": 0, "isCoffee": false },
        { "id": "iced-americano-uuid", "name": "Iced", "basePrice": 0, "priceAdjustment": 0, "isCoffee": false }
      ]
    },
    {
      "uniqueKey": "product-336:Temp",
      "displayName": "Velvety Cloud Latte Temp",
      "parentProductId": "product-336",
      "parentProductName": "Velvety Cloud Latte",
      "groupName": "Temp",
      "items": [
        { "id": "hot-latte-uuid", "name": "Hot", "basePrice": 0, "priceAdjustment": 0, "isCoffee": false },
        { "id": "iced-latte-uuid", "name": "Iced", "basePrice": 0, "priceAdjustment": 0, "isCoffee": false }
      ]
    },
    {
      "uniqueKey": "product-292:Temp",
      "displayName": "Cappu-corniccino Temp",
      "parentProductId": "product-292",
      "parentProductName": "Cappu-corniccino",
      "groupName": "Temp",
      "items": [
        { "id": "hot-cappu-uuid", "name": "Hot", "basePrice": 0, "priceAdjustment": 0, "isCoffee": false },
        { "id": "iced-cappu-uuid", "name": "Iced", "basePrice": 0, "priceAdjustment": 0, "isCoffee": false }
      ]
    },
    {
      "uniqueKey": "root:Danish",
      "displayName": "Danish",
      "groupName": "Danish",
      "items": [
        { "id": "product-303", "name": "Blueberry Danish", "basePrice": 6.50, "priceAdjustment": 0, "isCoffee": false },
        { "id": "product-302", "name": "Apple Salted Caramel Danish", "basePrice": 6.50, "priceAdjustment": 0, "isCoffee": false },
        { "id": "product-301", "name": "Burnt Cheese Danish", "basePrice": 6.50, "priceAdjustment": 0, "isCoffee": false },
        { "id": "product-284", "name": "Golden Glow Butterscotch Muffin", "basePrice": 7.00, "priceAdjustment": 0.50, "isCoffee": false },
        { "id": "product-285", "name": "Sinful Chocolate", "basePrice": 7.00, "priceAdjustment": 0.50, "isCoffee": false }
      ]
    }
  ],
  "optionalItems": [
    {
      "id": "milk-upgrade",
      "name": "Milk drink",
      "basePrice": 5.00,
      "priceAdjustment": 1.50,
      "isCoffee": false
    }
  ]
}
```

**Key points:**
- `"root:Drink"` and `"root:Danish"` are top-level groups (no `parentProductId`)
- `"product-337:Temp"` is a nested group — it only applies when Dark Mane Americano is selected in the Drink group
- `"product-336:Temp"` is a separate nested group for Velvety Cloud Latte — each drink has its own temperature group
- Iced Peach Tea and Iced Apple Tea have no nested Temp group (they're always iced) — no entry with their ID as `parentProductId`
- Not every drink has a temperature group. Only show a Temp group if one exists for the selected drink
- Items with `isCoffee: true` are coffee products — show milk/sugar customization options when selected
- Items with `isCoffee: false` (teas, danishes, etc.) should not show coffee-specific options
- The `isCoffee` flag is derived from the product's category in the POS database

#### Rendering the Modal

**Step 1: Separate top-level and nested groups**

```typescript
const topLevelGroups = selectionConfig.xorGroups.filter(g => !g.parentProductId);
const nestedGroups = selectionConfig.xorGroups.filter(g => !!g.parentProductId);
```

**Step 2: Track selections**

```typescript
// Key = group's uniqueKey, Value = selected item's id
const [selections, setSelections] = useState<Record<string, string>>({});
```

**Step 3: Render top-level groups as radio buttons**

```tsx
{topLevelGroups.map(group => (
  <div key={group.uniqueKey}>
    <h3>{group.groupName} <span>Required</span></h3>
    {group.items.map(item => (
      <div key={item.id}>
        <RadioButton
          selected={selections[group.uniqueKey] === item.id}
          onChange={() => setSelections(prev => ({ ...prev, [group.uniqueKey]: item.id }))}
        />
        <span>{item.name}</span>
        {/* Price display — see Price Calculation below */}
        <PriceTag item={item} hasComboOverride={!!product.combo_price_override} />

        {/* Step 4: Render nested groups inline, directly under the selected parent */}
        {selections[group.uniqueKey] === item.id &&
          nestedGroups
            .filter(ng => ng.parentProductId === item.id)
            .map(nestedGroup => (
              <div key={nestedGroup.uniqueKey} style={{ marginLeft: 16 }}>
                <h4>{nestedGroup.groupName}</h4>
                {nestedGroup.items.map(nestedItem => (
                  <RadioButton
                    key={nestedItem.id}
                    selected={selections[nestedGroup.uniqueKey] === nestedItem.id}
                    onChange={() => setSelections(prev => ({
                      ...prev,
                      [nestedGroup.uniqueKey]: nestedItem.id
                    }))}
                    label={nestedItem.name}
                  />
                ))}
              </div>
            ))
        }
      </div>
    ))}
  </div>
))}
```

**Step 5: Render optional items as checkboxes**

```tsx
{selectionConfig.optionalItems.map(item => (
  <Checkbox
    key={item.id}
    checked={selectedOptionals.has(item.id)}
    onChange={() => toggleOptional(item.id)}
    label={item.name}
  />
))}
```

**Important rendering rules:**
- A nested group is **only visible** when its `parentProductId` matches the currently selected item in the parent group
- When the user switches their drink selection, **hide** the old drink's nested groups and **show** the new one's (if any)
- Clear nested selections when the parent selection changes (e.g., switching from Americano to Latte should reset the Temp selection)
- Not all items have nested groups — Iced Peach Tea has no temperature choice. Only render nested groups if `nestedGroups.filter(ng => ng.parentProductId === selectedItemId)` returns results
- The `uniqueKey` field (e.g., `"product-337:Temp"`) should be used as the key in your selections state — it's globally unique across all nesting levels

#### Price Calculation

When `combo_price_override` is set (most combos):
```typescript
// Sum priceAdjustment from ALL selected items (top-level AND nested)
let adjustments = 0;

// Add adjustments from top-level selections
topLevelGroups.forEach(group => {
  const selectedId = selections[group.uniqueKey];
  const selectedItem = group.items.find(i => i.id === selectedId);
  if (selectedItem) adjustments += selectedItem.priceAdjustment;
});

// Add adjustments from nested selections (e.g., Iced might cost extra)
nestedGroups.forEach(group => {
  const selectedId = selections[group.uniqueKey];
  const selectedItem = group.items.find(i => i.id === selectedId);
  if (selectedItem) adjustments += selectedItem.priceAdjustment;
});

// Add adjustments from optional items
selectionConfig.optionalItems.forEach(item => {
  if (selectedOptionals.has(item.id)) adjustments += item.priceAdjustment;
});

const finalPrice = product.combo_price_override + adjustments;
```

When no override (non-combo products with selections):
```
finalPrice = SUM(selected components' base_price)
```

**Display logic for each item in the modal:**
- If combo override is set and `priceAdjustment > 0`: show "+RM X.XX"
- If combo override is set and `priceAdjustment = 0`: show "Included"
- If no combo override: show "RM X.XX" (base price)

**Example:** Coffee & Danish combo (override RM9.90)
- Dark Mane Americano: `priceAdjustment = 0` → "Included", total stays RM9.90
- Velvety Cloud Latte: `priceAdjustment = 1.60` → "+RM 1.60", total becomes RM11.50
- Cappu-corniccino: `priceAdjustment = 1.50` → "+RM 1.50", total becomes RM11.40
- Milk drink (optional): `priceAdjustment = 1.50` → "+RM 1.50", adds on top of drink selection

### Product Categories

Categories come directly from POS product data. Common values: `coffee`, `non-coffee`, `food`, `combo`, `uncategorized`. The customer app should group/filter by these.

### Product Images

`image_url` is synced from POS. May be null for products without images. The customer app should show a placeholder for missing images.

---

## 2. Branch / Outlet Info

Branch data is synced from POS to Supabase alongside products. The customer app should read from the `branches` table instead of hardcoding store info.

### Supabase Table

#### `branches`
```sql
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### How to Use

```typescript
const { data: branches } = await supabase
  .from('branches')
  .select('*')
  .eq('is_active', true);

// For single-branch setup, just use the first result
const branch = branches?.[0];
// branch.name = "Main Branch"
// branch.address = "Shell Seksyen 13, PJ"
// branch.phone = "+60..."
```

### Sync Behavior

- Auto-syncs on branch create/update in POS
- Syncs on POS startup alongside products/recipes
- Included in manual "Catalog Sync" from admin dashboard

---

## 3. Online Ordering

### Order Lifecycle

Customer app creates orders; POS manages them through status transitions.

**Status flow:**
```
pending → accepted     Staff accepted, preparation starts
pending → rejected     Staff rejected (with optional reason)
accepted → ready       Order prepared, waiting for pickup
accepted → rejected    Staff rejected after initially accepting
ready → collected      Customer picked up the order
```

Terminal states: `collected`, `rejected` — no further transitions.

### Schema

#### `online_orders`
```sql
id                TEXT PRIMARY KEY          -- e.g. "A1006" (sequential, prefixed)
payment_ref       TEXT UNIQUE               -- Fiuu tranID
outlet_id         TEXT DEFAULT 'main'
status            TEXT                      -- pending/accepted/ready/collected/rejected
pickup_type       TEXT                      -- 'counter' | 'curbside'
customer_name     TEXT
customer_phone    TEXT
customer_fcm_token TEXT                     -- for push notifications (future)
total_paid        NUMERIC
currency          TEXT DEFAULT 'MYR'
reject_reason     TEXT
accepted_at       TIMESTAMPTZ
ready_at          TIMESTAMPTZ
collected_at      TIMESTAMPTZ
rejected_at       TIMESTAMPTZ
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```

#### `online_order_items`
```sql
id            UUID PRIMARY KEY
order_id      TEXT REFERENCES online_orders(id) ON DELETE CASCADE
product_id    TEXT                              -- UUID from `products` table
product_name  TEXT
qty           INTEGER
unit_price    NUMERIC
mods          JSONB
```

#### `outlet_settings`
```sql
outlet_id     TEXT PRIMARY KEY   -- 'main'
intake_paused BOOLEAN            -- when true, customer app blocks new orders
updated_at    TIMESTAMPTZ
```

### Creating Orders (Customer App)

When creating `online_order_items`, use the product's UUID from the `products` table as `product_id`:

```typescript
{
  product_id: product.id,      // UUID from products table (e.g. "a1b2c3d4-...")
  product_name: product.name,
  qty: quantity,
  unit_price: finalPrice,
  mods: {
    size: "Large",
    milk: "Oat",
    notes: "Extra hot please"
  }
}
```

For combos, include the selected components in `combo_selections` so the kitchen knows what to make. Use the group's `uniqueKey` as the key:

```typescript
{
  product_id: comboProduct.id,
  product_name: "Coffee & Danish Combo",
  qty: 1,
  unit_price: 11.50,  // 9.90 + 1.60 (Latte upgrade)
  mods: {
    combo_selections: {
      "root:Drink": { id: "product-336", name: "Velvety Cloud Latte" },
      "product-336:Temp": { id: "iced-latte-uuid", name: "Iced" },
      "root:Danish": { id: "product-303", name: "Blueberry Danish" }
    },
    selected_optionals: [
      { id: "milk-upgrade", name: "Milk drink" }
    ],
    notes: "Extra sambal"
  }
}
```

### Mods Format

The POS displays item mods from `online_order_items.mods`. Expected JSONB format:

```json
{
  "size": "Large",
  "milk": "Oat",
  "sugar": "Less",
  "ice": "No ice",
  "notes": "Extra hot please"
}
```

- `notes` is shown separately (italicized)
- All other keys are joined with " · " for display (e.g., "Large · Oat · Less Sugar · No ice")
- Key names are flexible — POS iterates all keys except `notes` and `combo_selections`
- Values should be human-readable strings

### Order ID Format

The POS displays `online_orders.id` as the order number (e.g., "A1006"). IDs should be easy to call out verbally in the shop.

---

## 4. Realtime Subscriptions

### Customer App: Order Status Updates

Subscribe to status changes on a specific order:

```typescript
const channel = supabase
  .channel(`order-${orderId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'online_orders',
      filter: `id=eq.${orderId}`,
    },
    (payload) => {
      const updated = payload.new;
      // updated.status — 'pending' | 'accepted' | 'ready' | 'collected' | 'rejected'
      // updated.reject_reason — string | null
      // updated.accepted_at, ready_at, collected_at, rejected_at — timestamps
    }
  )
  .subscribe();
```

### Required Realtime Setup

These tables need Realtime enabled in Supabase:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE online_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE products;  -- optional, for live menu updates
```

---

## 5. Customer App Responsibilities

### Handle Rejected Orders

When `status` becomes `rejected`:
1. Show a clear "Order Rejected" state (not "pending" forever)
2. Display `reject_reason` if present (e.g., "Reason: Out of oat milk")
3. If `reject_reason` is null, show generic message (e.g., "Your order could not be fulfilled")
4. Show a "Contact store" option or phone number
5. Refund: currently manual — show "Please contact the store for refund arrangements"

### Check Intake Status Before Checkout

```typescript
const { data } = await supabase
  .from('outlet_settings')
  .select('intake_paused')
  .eq('outlet_id', 'main')
  .single();

if (data?.intake_paused) {
  // Block new orders, show "Online ordering is temporarily unavailable"
}
```

Optionally subscribe to Realtime on `outlet_settings` to unblock automatically when staff resumes.

### Use Real Product UUIDs

The customer app must read products from the `products` table (not mock/hardcoded data). Product UUIDs from this table must be used as `product_id` in `online_order_items` — this is what connects online orders to POS inventory for stock tracking and kitchen display.

### Handle Product Availability

- Products with `available_online = false` should be hidden or greyed out
- The `available_online` flag is managed by POS staff via the online orders admin panel

### Stock Levels

The `products.stock_quantity` column is synced from the POS in real-time. POS is the source of truth for stock.

**How `stock_quantity` works:**
- `null` — stock is **not tracked** for this product (most items). Treat as always available.
- `0` — product is **out of stock**. Show as sold out / greyed out.
- `> 0` — product is in stock. Optionally show "X left" for low quantities.

**Sync behavior:**
- Every sale, stock check, or purchase order in the POS immediately syncs the updated stock to Supabase
- Full stock sync runs on POS startup and on manual catalog sync
- Stock is summed across all branches (currently single-branch)

```typescript
// Example: filter or annotate products by stock
products.forEach(product => {
  if (product.available_online === false) {
    // Hidden by staff
  } else if (product.stock_quantity !== null && product.stock_quantity <= 0) {
    // Out of stock — show as sold out
  } else {
    // Available (stock_quantity is null = untracked, or > 0)
  }
});
```

**Do NOT decrement stock from the customer app.** The POS handles stock deduction when it accepts the online order. The customer app should only read `stock_quantity` for display purposes.

---

## 6. Loyalty Program & Vouchers

Supabase is the source of truth for loyalty and vouchers (not SQLite). Both the POS and customer app read/write directly to Supabase.

### Supabase Tables

See `LOYALTY_SCHEMA.md` for the full SQL. Key tables:

- `loyalty_members` — customers enrolled in loyalty (identified by phone number)
- `loyalty_transactions` — audit log of points earned/redeemed
- `loyalty_config` — program settings (points per scan, threshold, voucher value)
- `vouchers` — discount codes (auto-generated from loyalty or manually created)

### Customer App: Loyalty Flow

1. **Check membership** — look up by phone number:
```typescript
const { data: member } = await supabase
  .from('loyalty_members')
  .select('*')
  .eq('phone', customerPhone)
  .single();
```

2. **Show points balance** — `member.points_balance` is the current balance, `member.total_points_earned` is lifetime

3. **Show transaction history:**
```typescript
const { data: transactions } = await supabase
  .from('loyalty_transactions')
  .select('*')
  .eq('member_id', member.id)
  .order('created_at', { ascending: false });
```

4. **Show available vouchers:**
```typescript
const { data: vouchers } = await supabase
  .from('vouchers')
  .select('*')
  .eq('member_id', member.id)
  .eq('is_active', true)
  .gt('expires_at', new Date().toISOString())
  .filter('times_used', 'lt', 'max_uses');  // not fully used
```

### Customer App: Applying Vouchers at Checkout

1. Customer enters a voucher code
2. Validate via POS API:
```typescript
const res = await fetch('/api/vouchers/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: 'CO-ABC123', order_total: 25.00 }),
});
const result = await res.json();
// result.valid — boolean
// result.reason — why it's invalid (if applicable)
// result.voucher.discount_amount — RM discount to apply
// result.voucher.type — 'fixed' or 'percent'
```

3. If valid, apply the discount and include the voucher in the order:
```typescript
{
  // ... in online_order mods or a new field:
  voucher_code: 'CO-ABC123',
  voucher_discount: 5.00,
}
```

4. **After order is paid**, increment `times_used` on the voucher:
```typescript
await supabase.rpc('increment_voucher_usage', { voucher_code: 'CO-ABC123' });
// Or: UPDATE vouchers SET times_used = times_used + 1 WHERE code = 'CO-ABC123'
```

### QR Code Content

The customer's QR code should encode their **phone number**. When scanned at the POS, the phone number is sent to `POST /api/loyalty/scan` which:
- Finds or creates the loyalty member
- Adds points (configurable, default 1 per scan)
- Auto-issues a voucher if the points threshold is reached
- Returns the updated balance and any voucher issued

### Loyalty Config

Staff configure the program via POS admin (`/admin/loyalty` > Config tab):
- **Points per scan** — how many points each visit earns (default: 1)
- **Points threshold** — points needed to earn a voucher (default: 10)
- **Voucher type** — fixed RM discount or percentage
- **Voucher value** — discount amount
- **Voucher validity** — days until expiry
- **Min order** — minimum order amount to use the voucher

---

## 7. Migration Notes

### Legacy `online_products` Table (being phased out)

The POS previously used a separate `online_products` table with hardcoded mock product IDs (`flat`, `latte`, `danish`, etc.) for sold-out toggles and stock counts. This is fully replaced by the `products` table which has real POS UUIDs, the `available_online` flag, and `stock_quantity`.

**Customer app should:**
- Read menu from `products` table (not `online_products`)
- Use `products.id` (UUID) as the product identifier everywhere
- Use `products.available_online` for availability (replaces `online_products.available`)
- Use `products.stock_quantity` for stock levels (replaces `online_products.stock_count`)
- Do NOT use the `decrement_stock` RPC — POS handles stock deduction on order accept
- Ignore `online_products` — it will be removed

---

## 6. Summary Checklist for Customer App (bubu1)

### Must Have
- [ ] Read menu from `products` table (not mock data)
- [ ] Use product UUIDs from `products.id` in order items
- [ ] Read branch info from `branches` table (not hardcoded)
- [ ] Handle all order statuses: pending, accepted, ready, collected, rejected
- [ ] Display `reject_reason` when order is rejected
- [ ] Check `outlet_settings.intake_paused` before allowing checkout
- [ ] Respect `available_online` flag — hide/grey out unavailable products
- [ ] Show products as sold out when `stock_quantity` is not null and `<= 0`
- [ ] Treat `stock_quantity = null` as untracked (always available)
- [ ] Never decrement stock from the customer app (POS handles it on order accept)
- [ ] Subscribe to `online_orders` Realtime for live order status updates

### Should Have
- [ ] Render `selection_config` modal for combo products (XOR radio buttons + optional checkboxes)
- [ ] Separate groups into top-level (`!parentProductId`) and nested (`parentProductId` is set)
- [ ] Show nested groups (e.g., Hot/Iced) only when their `parentProductId` matches the selected item in the parent group
- [ ] Clear nested selections when the parent selection changes
- [ ] Handle items with no nested groups (e.g., Iced Peach Tea has no Temp group — don't show one)
- [ ] Calculate combo prices: `combo_price_override + SUM(price_adjustment)` across ALL selected items (top-level + nested + optional)
- [ ] Show "Included" vs "+RM X.XX" for combo options based on `price_adjustment`
- [ ] Include `combo_selections` (keyed by `uniqueKey`) and `selected_optionals` in mods for combo orders
- [ ] Show placeholder for products without `image_url`
- [ ] Subscribe to `outlet_settings` Realtime for auto-unblock when intake resumes

### Loyalty & Vouchers
- [ ] Look up loyalty member by phone from `loyalty_members`
- [ ] Show points balance and transaction history
- [ ] Show available vouchers for the member
- [ ] Voucher code input at checkout — validate via `POST /api/vouchers/validate`
- [ ] Apply voucher discount to order total
- [ ] Increment `times_used` on voucher after successful payment
- [ ] QR code in customer app encodes phone number for in-store scanning

### Nice to Have
- [ ] Subscribe to `products` Realtime for live menu updates (new items, price changes)
- [ ] Cache product list locally, sync-check for updates on app open
- [ ] Show estimated wait time (can query recent orders)

---

## 7. Supabase Setup SQL (Core Tables)

Run this in the Supabase SQL Editor if the tables don't exist yet:

```sql
-- Products table (synced from POS)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'uncategorized',
  base_price NUMERIC NOT NULL DEFAULT 0,
  image_url TEXT,
  combo_price_override NUMERIC,
  selection_config JSONB,
  stock_quantity NUMERIC,
  available_online BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Recipe items (combo structure)
CREATE TABLE IF NOT EXISTS product_recipe_items (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'material',
  linked_product_id TEXT REFERENCES products(id),
  linked_product_name TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'unit',
  is_optional BOOLEAN DEFAULT false,
  selection_group TEXT,
  price_adjustment NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_recipe_product ON product_recipe_items(product_id);
CREATE INDEX IF NOT EXISTS idx_recipe_linked ON product_recipe_items(linked_product_id);

-- Branches (synced from POS)
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Online orders
CREATE TABLE IF NOT EXISTS online_orders (
  id TEXT PRIMARY KEY,
  payment_ref TEXT UNIQUE,
  outlet_id TEXT DEFAULT 'main',
  status TEXT NOT NULL DEFAULT 'pending',
  pickup_type TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_fcm_token TEXT,
  total_paid NUMERIC,
  currency TEXT DEFAULT 'MYR',
  reject_reason TEXT,
  accepted_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Online order items
CREATE TABLE IF NOT EXISTS online_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES online_orders(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  mods JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON online_order_items(order_id);

-- Outlet settings
CREATE TABLE IF NOT EXISTS outlet_settings (
  outlet_id TEXT PRIMARY KEY,
  intake_paused BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE online_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
```

After creating tables, trigger initial product sync from POS:
```bash
curl -X POST http://localhost:3000/api/admin/catalog-sync
```

Or use the "Catalog Sync" button on the POS admin dashboard.

---

## 8. Loyalty & Vouchers

Supabase is the source of truth for all loyalty data. Both the POS and customer app read/write directly — no API calls between them.

### Design: Multi-Program Counters

The system supports multiple independent loyalty programs running simultaneously. Each program has its own counter per customer, its own trigger type, and its own reward. Examples:

| Program | Trigger | Rule | Reward |
|---|---|---|---|
| Visit Stamps | POS QR scan | 10 scans | RM2 voucher |
| Purchase Rewards | Order paid | 1 per order | RM5 voucher |
| Spend Points | Order paid | 1pt per RM | RM10 at 100pts |

Programs are configured in the `loyalty_programs` table — no code changes needed to add a new counter type.

---

### Supabase Tables

#### `loyalty_programs`
One row per counter type. Staff manage this via POS admin.

```sql
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                         -- display name shown to customer
  description TEXT,
  trigger_type TEXT NOT NULL                  -- 'scan' | 'purchase' | 'manual'
    CHECK (trigger_type IN ('scan', 'purchase', 'manual')),
  points_per_trigger INTEGER NOT NULL DEFAULT 1,  -- points awarded per event (flat)
  points_per_rm NUMERIC,                      -- if set, awards floor(total * points_per_rm) instead of flat (purchase only)
  threshold INTEGER NOT NULL,                 -- points needed to earn a voucher
  voucher_type TEXT NOT NULL DEFAULT 'fixed'  -- 'fixed' | 'percent'
    CHECK (voucher_type IN ('fixed', 'percent')),
  voucher_discount_value NUMERIC NOT NULL,    -- RM amount or percent
  voucher_validity_days INTEGER NOT NULL DEFAULT 90,
  voucher_min_order NUMERIC,                  -- minimum order total to redeem (null = no minimum)
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `loyalty_members`
One row per customer, keyed by phone number.

```sql
CREATE TABLE IF NOT EXISTS loyalty_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `loyalty_member_programs`
Tracks each member's balance for each program separately.

```sql
CREATE TABLE IF NOT EXISTS loyalty_member_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  points_balance INTEGER NOT NULL DEFAULT 0,   -- current balance toward threshold
  total_earned INTEGER NOT NULL DEFAULT 0,     -- lifetime points earned
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_lmp_member ON loyalty_member_programs(member_id);
CREATE INDEX IF NOT EXISTS idx_lmp_program ON loyalty_member_programs(program_id);
```

#### `loyalty_transactions`
Audit log — one row per points event, linked to the specific program.

```sql
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  program_id UUID REFERENCES loyalty_programs(id),  -- nullable for legacy rows
  type TEXT NOT NULL,           -- 'earn' | 'redeem' | 'expire' | 'manual'
  points INTEGER NOT NULL,      -- positive = earn, negative = redeem/expire
  description TEXT,             -- human-readable, shown in customer app
  reference_id TEXT,            -- order_id, scan_id, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lt_member ON loyalty_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_lt_program ON loyalty_transactions(program_id);
```

#### `vouchers`
Auto-generated when a member hits a program's threshold. Can also be created manually.

```sql
CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,            -- e.g. 'VCH-A1B2C3-XY12'
  member_id UUID REFERENCES loyalty_members(id),
  program_id UUID REFERENCES loyalty_programs(id),  -- which program generated this
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  times_used INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 1,
  discount_value NUMERIC NOT NULL,
  type TEXT NOT NULL DEFAULT 'fixed'    -- 'fixed' | 'percent'
    CHECK (type IN ('fixed', 'percent')),
  min_order NUMERIC,
  reference_id TEXT,                    -- order_id or scan_id that triggered issuance
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vouchers_member ON vouchers(member_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
```

---

### POS Responsibilities

#### 1. Seeding programs (one-time, run in Supabase SQL editor)

```sql
-- Visit stamp program: 10 scans = RM5 voucher
INSERT INTO loyalty_programs
  (name, description, trigger_type, points_per_trigger, threshold,
   voucher_type, voucher_discount_value, voucher_validity_days, sort_order)
VALUES
  ('Visit Stamps', 'Earn 1 stamp per visit. 10 stamps = RM5 off.',
   'scan', 1, 10, 'fixed', 5.00, 90, 1);

-- Purchase program: 1 point per order = RM5 voucher at 10 orders
INSERT INTO loyalty_programs
  (name, description, trigger_type, points_per_trigger, threshold,
   voucher_type, voucher_discount_value, voucher_validity_days, sort_order)
VALUES
  ('Purchase Rewards', 'Earn 1 point per order. 10 orders = RM5 off.',
   'purchase', 1, 10, 'fixed', 5.00, 90, 2);

-- Spend-based program: 1pt per RM1 spent, RM10 voucher at 100pts
INSERT INTO loyalty_programs
  (name, description, trigger_type, points_per_trigger, points_per_rm, threshold,
   voucher_type, voucher_discount_value, voucher_validity_days, sort_order)
VALUES
  ('Spend & Earn', 'Earn 1 point per RM1 spent. 100 points = RM10 off.',
   'purchase', 1, 1.0, 100, 'fixed', 10.00, 90, 3);
```

Adjust thresholds and reward values to match your actual programs before inserting. You only need to seed the programs you want to run — delete any rows above that don't apply.

#### 2. Division of responsibility: bubu1 vs POS

| Trigger | Who handles it |
|---|---|
| `purchase` — online payment via Fiuu | **bubu1** (Fiuu callback in `app/api/fiuu/callback/route.ts`) |
| `scan` — staff scan customer QR at counter | **POS** (ren1) |
| `manual` — staff manually add/deduct points | **POS** (ren1) |

bubu1 already awards points for all active `purchase`-trigger programs automatically when a payment succeeds. **The POS only needs to implement the `scan` handler.**

#### 3. Awarding points on QR scan (POS responsibility)

The customer QR code encodes the customer's phone number (digits only). When staff scan it at the POS:

```typescript
async function handleLoyaltyScan(phone: string) {
  const now = new Date().toISOString();
  const member = await upsertMember(phone);

  const { data: programs } = await supabase
    .from('loyalty_programs')
    .select('*')
    .eq('trigger_type', 'scan')
    .eq('is_active', true)
    .order('sort_order');

  for (const program of programs ?? []) {
    await awardPoints(member, program, {
      type: 'earn',
      description: 'Visit scan',
      reference_id: null,
      now,
    });
  }
}
```

#### 4. Core `awardPoints` helper

Shared by both scan and purchase flows. Handles balance update, transaction log, and threshold check:

```typescript
async function upsertMember(phone: string, name?: string) {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('loyalty_members')
    .upsert({ phone, ...(name ? { name } : {}), updated_at: now }, { onConflict: 'phone' })
    .select('id')
    .single();
  return data!;
}

async function awardPoints(
  member: { id: string },
  program: LoyaltyProgram,
  opts: {
    type: string;
    description: string;
    reference_id: string | null;
    pointsOverride?: number;  // used for purchase programs (points_per_rm calculation)
    now?: string;
  },
) {
  const now = opts.now ?? new Date().toISOString();
  const points = opts.pointsOverride ?? program.points_per_trigger;

  // Upsert program enrollment row (creates it on first visit)
  const { data: enrollment } = await supabase
    .from('loyalty_member_programs')
    .upsert(
      { member_id: member.id, program_id: program.id, updated_at: now },
      { onConflict: 'member_id,program_id', ignoreDuplicates: false },
    )
    .select('id, points_balance, total_earned')
    .single();

  if (!enrollment) return;

  const newBalance = enrollment.points_balance + points;
  const vouchersToIssue = Math.floor(newBalance / program.threshold);
  const remainder = newBalance % program.threshold;

  // Update balance — deduct spent threshold multiples, carry remainder
  await supabase
    .from('loyalty_member_programs')
    .update({
      points_balance: remainder,
      total_earned: enrollment.total_earned + points,
      updated_at: now,
    })
    .eq('id', enrollment.id);

  // Audit log
  await supabase.from('loyalty_transactions').insert({
    member_id: member.id,
    program_id: program.id,
    type: opts.type,
    points,
    description: opts.description,
    reference_id: opts.reference_id,
    created_at: now,
  });

  // Issue a voucher for each threshold crossed in this event
  for (let i = 0; i < vouchersToIssue; i++) {
    await issueVoucher(member, program, opts.reference_id, now);
  }
}

async function issueVoucher(
  member: { id: string },
  program: LoyaltyProgram,
  referenceId: string | null,
  now: string,
) {
  const code = `VCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const expiresAt = program.voucher_validity_days
    ? new Date(Date.now() + program.voucher_validity_days * 86_400_000).toISOString()
    : null;

  await supabase.from('vouchers').insert({
    code,
    member_id: member.id,
    program_id: program.id,
    discount_value: program.voucher_discount_value,
    type: program.voucher_type,
    min_order: program.voucher_min_order,
    expires_at: expiresAt,
    reference_id: referenceId,
    max_uses: 1,
    times_used: 0,
    is_active: true,
    created_at: now,
  });
}
```

#### 5. Voucher validation (`POST /api/vouchers/validate`)

Customer app calls this at checkout. POS should expose this endpoint (or bubu1 queries Supabase directly — see Section 6.3 below).

```typescript
// Request: { code: string, order_total: number }
// Response: { valid: boolean, reason?: string, voucher?: { discount_value, type } }
```

Validation checks:
- `is_active = true`
- `expires_at` is null or in the future
- `times_used < max_uses`
- `order_total >= min_order` (if set)

#### 6. Incrementing voucher usage after payment

After a successful payment, if a voucher was applied:

```typescript
// Option A: Supabase RPC (recommended)
await supabase.rpc('increment_voucher_usage', { voucher_code: code });

// Option B: Manual
const { data: v } = await supabase.from('vouchers').select('times_used').eq('code', code).single();
await supabase.from('vouchers').update({ times_used: v.times_used + 1 }).eq('code', code);
```

Create the RPC in Supabase SQL editor:

```sql
CREATE OR REPLACE FUNCTION increment_voucher_usage(voucher_code TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE vouchers SET times_used = times_used + 1 WHERE code = voucher_code;
END;
$$;
```

---

### Customer App: What It Reads

The customer app (bubu1) reads loyalty data directly from Supabase. It does **not** call POS API endpoints for loyalty — only for voucher validation if you choose not to expose that via Supabase directly.

#### Fetching a member's loyalty status

```typescript
// 1. Look up member by phone
const { data: member } = await supabase
  .from('loyalty_members')
  .select('id, phone, name')
  .eq('phone', customerPhone)
  .single();

// 2. Get per-program balances
const { data: balances } = await supabase
  .from('loyalty_member_programs')
  .select('*, loyalty_programs(*)')
  .eq('member_id', member.id);

// 3. Get available vouchers
const now = new Date().toISOString();
const { data: vouchers } = await supabase
  .from('vouchers')
  .select('*')
  .eq('member_id', member.id)
  .eq('is_active', true)
  .or(`expires_at.is.null,expires_at.gt.${now}`)
  .filter('times_used', 'lt', 'max_uses');  // not fully used
```

#### QR code content

The QR code shown in the customer app encodes the customer's **phone number** (digits only). When staff scan it at the POS, the phone number is passed to the scan handler above.

---

### Checklist for POS (ren1) Implementation

#### One-time setup
- [ ] Run the SQL above to create `loyalty_programs`, `loyalty_member_programs`, `loyalty_transactions`, `vouchers` tables
- [ ] Create the `increment_voucher_usage` RPC function
- [ ] Seed initial programs via the SQL in Section 8.1

#### Scan handler (POS must implement)
- [ ] When staff scan a customer QR, decode the phone number and call `handleLoyaltyScan`
- [ ] Loop over all active `scan`-trigger programs using `awardPoints` helper
- [ ] Show staff confirmation: member name, points awarded, current balance, any voucher issued

#### Purchase handler (already done in bubu1)
- [ ] ~~Loop over purchase programs in payment callback~~ — bubu1's Fiuu callback handles this automatically for all active `purchase`-trigger programs. No POS action needed.

#### Admin UI
- [ ] Program management: list programs, toggle `is_active`, edit threshold / reward values
- [ ] Member lookup: search by phone, view per-program balances and transaction history
- [ ] Manual points adjustment: award or deduct points with a description (sets `type = 'manual'`)
- [ ] Voucher management: list active vouchers per member, mark as used, create manual vouchers

#### Optional
- [ ] Push notification or receipt print when a voucher is issued during scan
- [ ] Dashboard showing total members, points issued, vouchers redeemed

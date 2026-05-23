# CLAUDE.md — bubu1

Customer-facing online ordering app for Coffee Oasis. Next.js App Router on Vercel, Supabase as the database and storage backend, Fiuu (formerly Razer Pay) for payments.

## Deployment

- **Production branch**: `claude/fix-out-of-stock-display-G7cMn` → auto-deploys to Vercel
- **Repo**: `kayuwoody/bubu1`
- Never push to `main` directly

## Stack

- Next.js 14 App Router (`'use client'` pages + server route handlers)
- Supabase (PostgREST, Realtime, Storage) — service role client at `lib/online/supabase.ts`
- Fiuu payment gateway (IPN webhook at `/api/fiuu/callback`)
- Malaysia timezone (UTC+8) used for all day-boundary logic

## Env vars

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
FIUU_MERCHANT_ID
FIUU_VERIFY_KEY
FIUU_SECRET_KEY
NEXT_PUBLIC_SUPABASE_URL   (if needed client-side)
```

## Key source files

| File | Purpose |
|------|---------|
| `components/MenuAppV2.tsx` | Main customer menu SPA — cart, loyalty sheet, passes, promotions modal |
| `app/checkout/page.tsx` | Checkout flow — vouchers, passes, Fiuu redirect |
| `app/orders/page.tsx` | Merged online + POS order history |
| `app/order/[id]/page.tsx` | Order detail + receipt link |
| `app/passes/page.tsx` | Loyalty pass detail — usage bar, daily limit, QR |
| `app/vouchers/page.tsx` | Voucher wallet |
| `app/scanpass/[slug]/page.tsx` | QR bunting landing page → claim a same-day voucher |
| `lib/online/receiptGenerator.ts` | Generates self-contained HTML receipts |
| `lib/types.ts` | Shared TypeScript interfaces |

## API routes

### Menu / ordering
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/menu` | Fetch live menu with stock |
| GET | `/api/availability` | Branch open/closed status |
| POST | `/api/checkout` | Create `checkout_sessions` row, return Fiuu redirect URL |
| POST | `/api/fiuu/callback` | IPN — verify payment, create order, process loyalty, generate receipt |
| GET | `/api/orders` | Merged online + POS order history for a phone number |
| GET | `/api/orders/[id]` | Single order detail + `receipt_url` |
| PATCH | `/api/customer/arrived` | Mark customer arrived for curbside |

### Loyalty
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/loyalty/member` | Member profile + enrolled programs (passes + stamp cards) |
| POST | `/api/loyalty/member` | Register / look up member by phone |
| GET | `/api/loyalty/pass-products` | Products eligible for a pass program (`?program_id=X`) |
| GET | `/api/loyalty/pass-usage` | Recent usage log for an enrollment (`?enrollment_id=X`) |
| POST | `/api/passes/validate` | Validate pass at checkout — checks daily limit, returns `discount_amount` |
| GET | `/api/vouchers` | Vouchers for a phone number |

### Scan passes (QR buntings)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/scanpass/[slug]` | Load scan pass config |
| POST | `/api/scanpass/claim` | Claim voucher (idempotent — same phone+slug+day returns existing) |

### Misc
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/promotions` | Active promotions for modal (fails silently if table absent) |
| GET | `/receipts/[orderId]` | Proxy POS receipt HTML from Supabase Storage |
| GET | `/receipts/online/[orderId]` | Proxy online receipt HTML from Supabase Storage |

## Database tables (Supabase)

### Core ordering
- `online_orders` — customer orders; `customer_phone`, `status`, `pickup_type`, `total_paid`
- `online_order_items` — line items with `modifiers` JSONB
- `checkout_sessions` — pre-payment sessions; `code` column stores pass code if applied
- `pos_orders` — in-store orders; `loyalty_member_phone`
- `pos_order_items` — POS line items
- `fiuu_payments` — payment records

### Loyalty
- `loyalty_programs` — program config; `trigger_type` (`'pass'` | `'stamp'`), `pass_daily_limit` (null = unlimited)
- `loyalty_members` — members keyed by phone
- `loyalty_member_programs` — enrollments; `points_balance` = uses remaining, `total_earned` = originally granted
- `loyalty_program_products` — eligible product IDs per program
- `member_pass_usage` — one row per pass use; `enrollment_id` → `loyalty_member_programs.id`, `used_at`
- `loyalty_transactions` — points/stamp history

### Vouchers
- `vouchers` — `code`, `type` (`'fixed'`|`'percent'`), `discount_value`, `min_order_amount`, `expires_at`, `reference_id`
  - Scan pass vouchers: `reference_id = 'sp:{slug}:{phone}:{YYYY-MM-DD}'` (deduplication key)

### Scan passes
- `scan_passes` — `slug`, `name`, `description`, `image_url`, `voucher_type`, `voucher_value`, `is_active`, `one_per_phone_per_day`

### Promotions
- `promotions` — `title`, `subtitle`, `body`, `image_url`, `cta_text`, `cta_url`, `bg_color`, `text_color`, `is_active`, `sort_order`, `valid_from`, `valid_until`

## Important conventions

### Voucher column name
Always `min_order_amount` (not `min_order`).

### Pass deduplication
Scan passes use `vouchers.reference_id = 'sp:{slug}:{phone}:{YYYY-MM-DD}'`. Check before inserting; return existing if found.

### Malaysia time
```ts
function todayMYT() {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}
```
End of day expiry = midnight MYT = `Date.UTC(y, m-1, d, 16, 0, 0)` (adjusted if already past).

### Supabase Storage — HTML files
JS client `.upload()` ignores `contentType`. Use the REST API directly:
```ts
await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/receipts/${filename}`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'text/html; charset=utf-8',
    'x-upsert': 'true',
  },
  body: html,
});
```
Receipt proxy routes re-serve with correct `Content-Type` since Supabase Storage serves `.html` as `text/plain`.

### Receipt filenames
- Online: `online-order-{orderId}.html` in `receipts` bucket
- POS: `order-{orderId}.html` in `receipts` bucket

### Merged order history
`/api/orders` fetches `online_orders` (by `customer_phone`) and `pos_orders` (by `loyalty_member_phone`) in parallel, normalises to `{ source: 'online'|'pos', items: OrderItem[], pickup_type: string|null }`, merges, sorts by `created_at desc`, returns top 50.

### Pass progress bar
```ts
const usesSpent = Math.max(0, pass.total_earned - pass.points_balance);
// Do NOT use pass.threshold — that's a stamp target, unrelated to pass usage counts
```

### Checkout pass submission
Pass code is stored in `checkout_sessions.code` (not `pass_code`):
```ts
...(pass_code ? { code: pass_code.trim().toUpperCase() } : {})
```

## Promotions modal behaviour
- Fetched at page load alongside menu data
- Dismissed once per day via `localStorage.setItem('promo_dismissed', 'YYYY-MM-DD')`
- Multiple promos → scrollable dot-indicator slides
- Card is clickable if `cta_url` is set (external = new tab, internal = same tab)
- `cta_text` renders as a label button independently of `cta_url`

## No RLS
All tables use service role key server-side. RLS is disabled for now — add policies before any public multi-tenant use.

## Pending / known gaps
- `arrived_at` column on `online_orders` for curbside "I'm here" tracking not yet implemented
- WhatsApp notifications on order `ready` not wired up
- RLS policies needed before wider rollout

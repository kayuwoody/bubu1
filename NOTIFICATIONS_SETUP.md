# Push notifications — setup

Order-ready web-push notifications. The POS already writes `online_orders.status = 'ready'`
directly to Supabase; a Supabase Database Webhook fires `/api/push/notify-ready`, which
sends the push. No POS changes.

Nothing sends until the steps below are done — the code fails safe (no VAPID keys =
no-op), so it's fine to deploy first and configure after.

## 1. Generate VAPID keys

```bash
npx web-push generate-vapid-keys --json
```

Generate your **own** pair — don't reuse any keys pasted into a chat/transcript.
You get a `publicKey` and `privateKey`.

## 2. Vercel env vars (Production)

| Var | Value |
|-----|-------|
| `VAPID_PUBLIC_KEY` | the publicKey |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the **same** publicKey (exposed to the browser) |
| `VAPID_PRIVATE_KEY` | the privateKey (secret) |
| `VAPID_SUBJECT` | `mailto:you@coffee-oasis.com` |
| `PUSH_WEBHOOK_SECRET` | any long random string (used to auth the webhook) |

Redeploy after setting them (NEXT_PUBLIC_* bake in at build time).

## 3. Database (Supabase SQL)

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      text,
  endpoint   text UNIQUE NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_phone ON push_subscriptions(phone);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;  -- service-role only, no policies

ALTER TABLE online_orders ADD COLUMN IF NOT EXISTS ready_notified_at timestamptz;

NOTIFY pgrst, 'reload schema';
```

## 4. Supabase Database Webhook

Dashboard → **Database → Webhooks → Create a new hook**:

- **Table:** `online_orders`
- **Events:** `UPDATE` only
- **Type:** HTTP Request → `POST`
- **URL:** `https://coffee-oasis.com/api/push/notify-ready`
- **HTTP Headers:** add `x-webhook-secret` = the same value as `PUSH_WEBHOOK_SECRET`

Supabase sends `{ type, record, old_record, ... }`. The handler:
- **ignores** everything except the `status` transition **into** `ready`
  (accept/reject/collect and any later touch are skipped),
- **atomically** claims `ready_notified_at` so a customer never gets two pushes,
- looks up subscriptions by `customer_phone` and sends, pruning dead ones.

## 5. Customer opt-in

On the order status page, active orders show **"🔔 Notify me when it's ready"**.
Tapping it requests browser permission and subscribes. Tapping again turns it off.

**iOS:** web push only works when the site is **installed to the home screen**
(the "Add to home screen" card). On iOS Safari tabs the page shows a hint to
install first instead of the button.

## Test

1. Opt in on an order page (grant permission).
2. In Supabase, set that order's `status` to `ready`.
3. The push should arrive within a second or two; tapping it opens the order.

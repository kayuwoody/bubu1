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

## 4. Fire the webhook — SQL trigger (recommended)

Supabase "Database Webhooks" are just triggers under the hood and the dashboard
location moves between versions (look under **Database → Webhooks** or
**Integrations → Webhooks** if you prefer clicking). The SQL below is the same
mechanism, version-proof, and pre-filters to the ready transition so the endpoint
is only ever called for real ready events. Run it in the SQL editor — replace the
secret and URL:

```sql
create extension if not exists pg_net;

create or replace function notify_order_ready()
returns trigger
language plpgsql
security definer
set search_path = ''          -- hardening: no search_path hijack
as $$
begin
  if new.status = 'ready' and (old.status is distinct from 'ready') then
    perform net.http_post(
      url := 'https://coffee-oasis.com/api/push/notify-ready',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', 'YOUR_PUSH_WEBHOOK_SECRET'   -- match Vercel env exactly
      ),
      body := jsonb_build_object(
        'type', 'UPDATE',
        'record', row_to_json(new),
        'old_record', row_to_json(old)
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_order_ready on online_orders;
create trigger trg_notify_order_ready
  after update on online_orders
  for each row
  execute function notify_order_ready();
```

`pg_net` posts asynchronously, so it never slows the POS's status update. The
`/api/push/notify-ready` handler then independently: verifies the secret, re-checks
the ready transition, **atomically** claims `ready_notified_at` (no double push),
looks up subscriptions by `customer_phone`, sends, and prunes dead ones.

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

## Security notes

Consistent with the app's existing model (phone-based, no login, service-role,
RLS-deny). Specifics for push:

- **`/api/push/notify-ready`** is protected by the `x-webhook-secret` shared
  secret. Keep it strong and secret (Vercel env + the trigger body). A leak would
  let someone POST fake "ready" events → spurious pushes to opted-in customers.
  Idempotency (`ready_notified_at`) limits repeats. Rotate the secret if exposed.
- **`/api/push/subscribe` trusts the phone** (no OTP), like the rest of the app.
  Worst case: someone associates *their own* device with *another* phone and
  receives that person's "order ready" push (leaks an order id). Low impact; an
  OTP step would close it if ever needed — same gap as order lookup generally.
- **`push_subscriptions` has RLS enabled with no policies** (service-role only),
  matching the other tables. The stored keys only matter combined with the secret
  VAPID private key, which is server-only.
- **Only our server can send pushes** — the VAPID *private* key never leaves the
  server. Payloads (title/body/url) are server-authored, and the service worker
  refuses to navigate anywhere except same-origin paths.
- **`/api/push/test`** is an open TEMP endpoint but can only push to a
  subscription the caller already possesses (their own device). Remove before
  launch (tracked in `todo.md`).
- **Dependency:** `web-push` adds no flagged vulnerabilities; the `npm audit`
  `ws` findings pre-date this and come from `@supabase/*`, not push.

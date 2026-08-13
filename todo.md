# TODO

## Push notifications

- [ ] **Remove the temporary test-notification UI before launch.** All marked `TEMP`:
  - `NotifyTestButton` in `components/MenuAppV2.tsx` (shown only with `?ntest=1`)
    and its render line.
  - "Send a test notification" button on the order page (`app/order/[id]/page.tsx`).
  - Endpoint `app/api/push/test/route.ts` and `sendTestPush()` in `lib/pushClient.ts`.
  Delete once push is verified in the wild.

- [ ] **Drop order-page polling in favour of push (only once push is proven).**
  `app/order/[id]/page.tsx` polls `/api/orders/[id]` every 5s. Once order-ready
  push is confirmed reliable across several real orders, this polling can be
  removed or slowed way down. Keep BOTH running until then — don't remove
  polling before push is trusted, or customers could miss "ready".

## Loyalty

- [ ] **Deactivate the orphaned "Car Wash Customers" loyalty program.**
  Program id `9115686e-aec5-4a18-96f9-08dc14e24f65`, `trigger_type='manual'`.
  The carwash is a voucher-type scanpass — it mints vouchers straight from
  the `scan_passes` row (`voucher_type`/`voucher_value`) and does NOT use a
  loyalty_programs row (confirmed: no scan_passes row references this id,
  carwash scanpass verified working). This row is a stray that collided with
  the Welcome voucher lookup (both active `manual`). Welcome now resolves by
  `program_key='welcome'` so it no longer interferes; this row is just
  cleanup. DB-only, no deploy:
      UPDATE loyalty_programs SET is_active = false
      WHERE id = '9115686e-aec5-4a18-96f9-08dc14e24f65';

## Fiuu

- [ ] **Confirm & remove the unused `/api/webhooks/fiuu` endpoint.**
  There are two Fiuu callback routes:
  - `/api/fiuu/callback` — the real one: verifies signature, creates the
    order, processes loyalty, issues vouchers, generates the receipt.
  - `/api/webhooks/fiuu` — leaner duplicate: only upserts a `fiuu_payments`
    row. Does **not** create orders or process loyalty.

  First confirm the Fiuu merchant portal points at `/api/fiuu/callback`.
  If it does (it almost certainly does — orders + loyalty are working),
  delete `app/api/webhooks/fiuu/route.ts` so nobody points Fiuu at the
  dead endpoint by mistake (which would silently stop orders/loyalty while
  still recording payments).

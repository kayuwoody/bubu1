# TODO

## Loyalty

- [ ] **Fix "Car Wash Customers" loyalty program trigger_type.**
  It's currently `trigger_type = 'manual'` but is meant to be a scanpass.
  Program id `9115686e-aec5-4a18-96f9-08dc14e24f65`. This mis-typing was
  what collided with the Welcome voucher lookup (both were active `manual`
  programs). The welcome path now resolves by `program_key='welcome'` so it
  no longer interferes, but the car wash program's type should still be
  corrected to match how it's actually used.

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

# TODO

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

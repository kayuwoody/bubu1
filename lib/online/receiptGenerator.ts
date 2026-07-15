const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const MASCOT_URL   = `${SUPABASE_URL}/storage/v1/object/public/receipts/mascot.jpg`;

interface ReceiptItem {
  product_name: string;
  qty:          number;
  unit_price:   number;
  mods?:        Record<string, unknown> | null;
}

interface ReceiptOrder {
  id:               string;
  customer_name:    string;
  pickup_type:      string;
  total_paid:       number;
  voucher_code?:    string | null;
  voucher_discount?: number | null;
  created_at:       string;
}

function modsLine(mods: Record<string, unknown> | null | undefined): string {
  if (!mods) return '';
  const parts: string[] = [];
  if (mods.combo_selections && typeof mods.combo_selections === 'object') {
    for (const v of Object.values(mods.combo_selections as Record<string, { name: string }>)) {
      if (v?.name) parts.push(v.name);
    }
  }
  if (mods.sugar && mods.sugar !== 'Zero') parts.push(`${mods.sugar} sugar`);
  if (mods.milk  && mods.milk  !== 'Full')  parts.push(`${mods.milk} milk`);
  if (Array.isArray(mods.selected_optionals)) {
    for (const o of mods.selected_optionals as Array<{ name: string }>) {
      if (o?.name) parts.push(`+ ${o.name}`);
    }
  }
  if (mods.notes) parts.push(`"${mods.notes as string}"`);
  return parts.join(' · ');
}

export function generateReceiptHtml(order: ReceiptOrder, items: ReceiptItem[]): string {
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
  const pickup  = order.pickup_type === 'curbside' ? 'Curbside pickup' : 'Counter pickup';

  const itemRows = items.map(item => {
    const mods = modsLine(item.mods);
    const lineTotal = (Number(item.unit_price) * item.qty).toFixed(2);
    return `
      <tr>
        <td style="padding:8px 0;vertical-align:top;">
          <div style="font-weight:700;color:#3A2414;">${item.qty}× ${item.product_name}</div>
          ${mods ? `<div style="font-size:12px;color:#7B6252;margin-top:2px;">${mods}</div>` : ''}
        </td>
        <td style="padding:8px 0;text-align:right;vertical-align:top;font-weight:600;color:#3A2414;white-space:nowrap;">
          RM ${lineTotal}
        </td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Receipt — Order #${order.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    background: #EFE4D1;
    min-height: 100vh;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 24px 12px 48px;
  }
  .card {
    background: #fff;
    border-radius: 20px;
    width: 100%;
    max-width: 28rem;
    overflow: hidden;
    box-shadow: 0 4px 32px rgba(58,36,20,.15);
  }
  .header {
    background: #3A2414;
    padding: 28px 24px 22px;
    text-align: center;
  }
  .mascot {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid #F58220;
    margin-bottom: 12px;
  }
  .brand {
    font-size: 22px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -.3px;
  }
  .tagline {
    font-size: 13px;
    color: rgba(255,255,255,.55);
    margin-top: 3px;
  }
  .thank-you {
    background: #F58220;
    text-align: center;
    padding: 12px 24px;
    font-size: 15px;
    font-weight: 700;
    color: #fff;
    letter-spacing: .01em;
  }
  .body { padding: 24px; }
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 6px;
  }
  .meta-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: rgba(58,36,20,.45);
  }
  .meta-value {
    font-size: 14px;
    font-weight: 600;
    color: #3A2414;
    text-align: right;
  }
  .divider {
    border: none;
    border-top: 1.5px dashed rgba(58,36,20,.15);
    margin: 18px 0;
  }
  table { width: 100%; border-collapse: collapse; }
  .section-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: rgba(58,36,20,.45);
    margin-bottom: 10px;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 0 0;
    border-top: 2px solid #3A2414;
    margin-top: 6px;
  }
  .total-label { font-size: 16px; font-weight: 800; color: #3A2414; }
  .total-amount { font-size: 20px; font-weight: 800; color: #3A2414; }
  .sub-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    font-size: 14px;
    color: rgba(58,36,20,.65);
  }
  .discount-amount { color: #16A34A; font-weight: 700; }
  .footer {
    background: #FFF6E8;
    padding: 16px 24px;
    text-align: center;
    border-top: 1.5px dashed rgba(58,36,20,.15);
    font-size: 13px;
    color: rgba(58,36,20,.55);
    line-height: 1.6;
  }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <img src="${MASCOT_URL}" alt="Coffee Oasis" class="mascot" />
    <div class="brand">Coffee Oasis</div>
    <div class="tagline">Your receipt</div>
  </div>

  <div class="thank-you">Thank you, ${order.customer_name || 'valued customer'}! ☕</div>

  <div class="body">
    <div class="meta-row">
      <span class="meta-label">Order</span>
      <span class="meta-value">#${order.id}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Date</span>
      <span class="meta-value">${dateStr}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Time</span>
      <span class="meta-value">${timeStr}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Pickup</span>
      <span class="meta-value">${pickup}</span>
    </div>

    <hr class="divider" />

    <div class="section-label">Items</div>
    <table>
      <tbody>${itemRows}</tbody>
    </table>

    ${order.voucher_discount != null && order.voucher_discount > 0 ? `
    <div class="sub-row">
      <span>Subtotal</span>
      <span>RM ${(Number(order.total_paid) + Number(order.voucher_discount)).toFixed(2)}</span>
    </div>
    <div class="sub-row">
      <span>Voucher${order.voucher_code ? ` (${order.voucher_code})` : ''}</span>
      <span class="discount-amount">−RM ${Number(order.voucher_discount).toFixed(2)}</span>
    </div>` : ''}
    <div class="total-row">
      <span class="total-label">Total paid</span>
      <span class="total-amount">RM ${Number(order.total_paid).toFixed(2)}</span>
    </div>
  </div>

  <div class="footer">
    Paid online · Coffee Oasis<br/>
    Thank you for your support!
  </div>
</div>
</body>
</html>`;
}

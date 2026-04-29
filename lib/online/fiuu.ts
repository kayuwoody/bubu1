import crypto from 'crypto';

function md5(v: string) {
  return crypto.createHash('md5').update(v).digest('hex');
}

export function verifyFiuuCallback(body: Record<string, string>): boolean {
  const secretKey = process.env.FIUU_SECRET_KEY;
  if (!secretKey) throw new Error('FIUU_SECRET_KEY not set');

  // Set FIUU_SKIP_VERIFY=true in Vercel for sandbox testing
  if (process.env.FIUU_SKIP_VERIFY === 'true') {
    console.warn('[fiuu/verify] signature check SKIPPED (FIUU_SKIP_VERIFY=true)');
    return true;
  }

  // Fiuu sends orderid lowercase; use whichever key has a value
  const tranID   = body.tranID   ?? body.TranID  ?? '';
  const orderid  = body.orderid  ?? body.orderID ?? body.OrderID ?? '';
  const status   = body.status   ?? body.Status  ?? body.StatCode ?? '';
  const domain   = body.domain   ?? body.Domain  ?? '';
  const amount   = body.amount   ?? body.Amount  ?? '';
  const currency = body.currency ?? body.Currency ?? 'MYR';
  const paydate  = body.paydate  ?? body.Paydate ?? '';
  const skey     = body.skey     ?? '';

  const mask = (k: string) => k ? `${k.slice(0,4)}...${k.slice(-4)} (len ${k.length})` : 'MISSING';
  console.log('[fiuu/verify] secretKey:', mask(secretKey));
  console.log('[fiuu/verify] fields — tranID:', tranID, 'orderid:', orderid, 'status:', status,
    'domain:', domain, 'amount:', amount, 'currency:', currency, 'paydate:', paydate);
  console.log('[fiuu/verify] skey from Fiuu:', skey);

  // Confirmed formula: md5(md5(tranID+orderid+status+domain+amount+currency+paydate+secretKey))
  const raw  = `${tranID}${orderid}${status}${domain}${amount}${currency}${paydate}${secretKey}`;
  const computed = md5(md5(raw));
  console.log('[fiuu/verify] computed:', computed, computed === skey ? '✓ MATCH' : '✗ MISMATCH');

  return computed === skey;
}

export function isFiuuSuccess(status: string) {
  return status === '00';
}

export interface FiuuHostedForm {
  action: string;
  fields: Record<string, string>;
}

// Builds action URL + mps-prefixed form fields for a direct POST to Fiuu's hosted payment page.
// Uses mps-prefixed param names (same as Seamless SDK) but posts the form directly — no SDK,
// no jQuery, no mpslinkkey required.
export function buildFiuuHostedForm(opts: {
  sessionId:      string;
  amount:         number;
  currency?:      string;
  baseUrl:        string;
  channel:        string;
  customerName?:  string;
  customerEmail?: string;
  customerPhone?: string;
}): FiuuHostedForm {
  const merchantId = process.env.FIUU_MERCHANT_ID;
  const verifyKey  = process.env.FIUU_VERIFY_KEY;
  const fiuuBase   = process.env.FIUU_BASE_URL ?? 'https://pay.fiuu.com';
  if (!merchantId || !verifyKey) throw new Error('FIUU_MERCHANT_ID and FIUU_VERIFY_KEY must be set');

  const amountStr = opts.amount.toFixed(2);
  const currency  = opts.currency ?? 'MYR';
  // Strip hyphens — Fiuu normalises orderID before vcode verification
  const orderId   = opts.sessionId.replace(/-/g, '');

  // vcode = md5(amount + merchantID + orderID + verifyKey)
  const vcode = md5(amountStr + merchantId + orderId + verifyKey);
  console.log('[fiuu/build] amount:', amountStr, 'merchantId:', merchantId, 'orderId:', orderId, 'vcode:', vcode);

  const action = `${fiuuBase}/RMS/pay/${merchantId}`;

  const fields: Record<string, string> = {
    mpsmerchantid:  merchantId,
    mpschannel:     opts.channel,
    mpsamount:      amountStr,
    mpsorderid:     orderId,
    mpsbill_name:   opts.customerName  ?? '',
    mpsbill_email:  opts.customerEmail || 'noreply@coffeeoasis.my',
    mpsbill_mobile: opts.customerPhone ?? '',
    mpsbill_desc:   'Coffee Oasis Order',
    mpscurrency:    currency,
    mpsvcode:       vcode,
    mpsreturnurl:   `${opts.baseUrl}/return`,
    mpscallbackurl: `${opts.baseUrl}/api/fiuu/callback`,
    mpsnotifyurl:   `${opts.baseUrl}/api/fiuu/callback`,
    mpslangcode:    'en',
  };

  console.log('[fiuu/build] action:', action, 'fields:', JSON.stringify(fields));
  return { action, fields };
}

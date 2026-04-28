import crypto from 'crypto';

function md5(v: string) {
  return crypto.createHash('md5').update(v).digest('hex');
}

export function verifyFiuuCallback(body: Record<string, string>): boolean {
  const secretKey = process.env.FIUU_SECRET_KEY;
  const verifyKey = process.env.FIUU_VERIFY_KEY;
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

export interface FiuuPaymentData {
  url:    string;
  params: Record<string, string>;
}

// Returns a URL + POST params for Fiuu's hosted payment page (shows all methods).
// The checkout page must auto-submit these as a hidden POST form.
export function buildFiuuPaymentData(opts: {
  sessionId:     string;
  amount:        number;
  currency?:     string;
  channel?:      string;
  baseUrl:       string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}): FiuuPaymentData {
  const merchantId = process.env.FIUU_MERCHANT_ID;
  const verifyKey  = process.env.FIUU_VERIFY_KEY;
  const fiuuBase   = process.env.FIUU_BASE_URL ?? 'https://payment.fiuu.com';
  if (!merchantId || !verifyKey) throw new Error('FIUU_MERCHANT_ID and FIUU_VERIFY_KEY must be set');

  const amountStr = opts.amount.toFixed(2);
  const currency  = opts.currency ?? 'MYR';

  // vcode = md5(amount + merchantID + orderID + verifyKey)
  const vcode = md5(amountStr + merchantId + opts.sessionId + verifyKey);

  // Omitting channel shows Fiuu's hosted channel selection page.
  // Pass a specific channel code (e.g. 'credit', 'TNG-EWALLET') to skip selection.
  const channelPath = opts.channel ? `/${opts.channel}` : '';
  // Trailing slash required when using POST method (per Fiuu docs)
  const url = `${fiuuBase}/RMS/pay/${merchantId}${channelPath}/`;

  const params: Record<string, string> = {
    merchant_id:  merchantId,
    orderid:      opts.sessionId,
    amount:       amountStr,
    currency,
    vcode,
    returnurl:    `${opts.baseUrl}/return`,
    bill_name:    opts.customerName  ?? '',
    bill_email:   opts.customerEmail ?? '',
    bill_mobile:  opts.customerPhone ?? '',
    bill_desc:    'Coffee Oasis Order',
  };

  return { url, params };
}

import crypto from 'crypto';

function md5(v: string) {
  return crypto.createHash('md5').update(v).digest('hex');
}

export function verifyFiuuCallback(body: Record<string, string>): boolean {
  const secretKey = process.env.FIUU_SECRET_KEY;
  if (!secretKey) throw new Error('FIUU_SECRET_KEY not set');

  if (process.env.FIUU_SKIP_VERIFY === 'true') {
    console.warn('[fiuu/verify] signature check SKIPPED (FIUU_SKIP_VERIFY=true)');
    return true;
  }

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

  const raw     = `${tranID}${orderid}${status}${domain}${amount}${currency}${paydate}${secretKey}`;
  const computed = md5(md5(raw));
  console.log('[fiuu/verify] computed:', computed, computed === skey ? '✓ MATCH' : '✗ MISMATCH');

  return computed === skey;
}

export function isFiuuSuccess(status: string) {
  return status === '00';
}

export interface FiuuSeamlessResult {
  scriptUrl: string;
  // JSON body to return from the /api/checkout endpoint — the SDK reads this
  // after POSTing to the merchant's process_order endpoint (role="molpayseamless" pattern)
  mpsParams: Record<string, string | boolean | number>;
}

export function buildFiuuSeamlessParams(opts: {
  sessionId:      string;
  amount:         number;
  currency?:      string;
  baseUrl:        string;
  channel:        string;
  customerName?:  string;
  customerEmail?: string;
  customerPhone?: string;
}): FiuuSeamlessResult {
  const merchantId = process.env.FIUU_MERCHANT_ID;
  const verifyKey  = process.env.FIUU_VERIFY_KEY;
  const fiuuBase   = process.env.FIUU_BASE_URL ?? 'https://pay.fiuu.com';
  if (!merchantId || !verifyKey) throw new Error('FIUU_MERCHANT_ID and FIUU_VERIFY_KEY must be set');

  const amountStr = opts.amount.toFixed(2);
  const currency  = opts.currency ?? 'MYR';
  const orderId   = opts.sessionId.replace(/-/g, '');

  const vcode = md5(amountStr + merchantId + orderId + verifyKey + currency);
  const mask = (k: string) => k ? `${k.slice(0,4)}...${k.slice(-4)} (len ${k.length})` : 'MISSING';
  console.log('[fiuu/build] verifyKey:', mask(verifyKey));
  console.log('[fiuu/build] amount:', amountStr, 'merchantId:', merchantId, 'orderId:', orderId, 'vcode:', vcode);

  const isSandbox = fiuuBase.includes('sandbox');
  const scriptUrl = isSandbox
    ? `${fiuuBase}/MOLPay/API/seamless/3.28/js/MOLPay_seamless_sandbox.deco.js`
    : `${fiuuBase}/MOLPay/API/seamless/3.28/js/MOLPay_seamless.deco.js`;

  const mpsParams = {
    status:         true,
    mpsmerchantid:  merchantId,
    mpschannel:     opts.channel,
    mpsamount:      amountStr,
    mpsorderid:     orderId,
    mpsbill_name:   opts.customerName  ?? '',
    mpsbill_email:  opts.customerEmail || 'noreply@coffeeoasis.my',
    mpsbill_mobile: opts.customerPhone ?? '',
    mpsbill_desc:   'Coffee Oasis Order',
    mpscountry:     'MY',
    mpsvcode:       vcode,
    mpscurrency:    currency,
    mpslangcode:    'en',
    mpscancelurl:   `${opts.baseUrl}/checkout?cancelled=1`,
    mpsreturnurl:   `${opts.baseUrl}/return`,
    mpscallbackurl: `${opts.baseUrl}/api/fiuu/callback`,
    mpsnotifyurl:   `${opts.baseUrl}/api/fiuu/callback`,
    mpsapiversion:  '3.28',
  };

  console.log('[fiuu/build] scriptUrl:', scriptUrl, 'params:', JSON.stringify(mpsParams));
  return { scriptUrl, mpsParams };
}

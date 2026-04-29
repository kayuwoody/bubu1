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

export interface FiuuSeamlessAttrs {
  scriptUrl: string;
  attrs:     Record<string, string>;
}

// Returns the Fiuu Seamless script URL and data-* attributes for a
// data-toggle="molpayseamless" button. The JS SDK handles channel
// selection and payment internally — no hosted page or GET redirect.
export function buildFiuuSeamlessAttrs(opts: {
  sessionId:      string;
  amount:         number;
  currency?:      string;
  baseUrl:        string;
  customerName?:  string;
  customerEmail?: string;
  customerPhone?: string;
}): FiuuSeamlessAttrs {
  const merchantId = process.env.FIUU_MERCHANT_ID;
  const verifyKey  = process.env.FIUU_VERIFY_KEY;
  const fiuuBase   = process.env.FIUU_BASE_URL ?? 'https://pay.fiuu.com';
  if (!merchantId || !verifyKey) throw new Error('FIUU_MERCHANT_ID and FIUU_VERIFY_KEY must be set');

  const amountStr = opts.amount.toFixed(2);
  const currency  = opts.currency ?? 'MYR';

  // vcode = md5(amount + merchantID + orderID + verifyKey)
  const vcode = md5(amountStr + merchantId + opts.sessionId + verifyKey);

  // Sandbox uses a different filename + cache-bust timestamp; production uses the versioned file
  const isSandbox = fiuuBase.includes('sandbox');
  const cacheBust = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const scriptUrl = isSandbox
    ? `${fiuuBase}/RMS/API/seamless/latest/js/MOLPay_seamless_sandbox.deco.js?v=${cacheBust}`
    : `${fiuuBase}/RMS/API/seamless/latest/js/MOLPay_seamless.deco.js`;

  const attrs: Record<string, string> = {
    'data-toggle':          'molpayseamless',
    'data-mpsmerchantid':   merchantId,
    'data-mpsamount':       amountStr,
    'data-mpsorderid':      opts.sessionId,
    'data-mpsbillname':     opts.customerName  ?? '',
    'data-mpsbillemail':    opts.customerEmail || 'noreply@coffeeoasis.my',
    'data-mpsbillmobile':   opts.customerPhone ?? '',
    'data-mpsbilldesc':     'Coffee Oasis Order',
    'data-mpscurrency':     currency,
    'data-mpsvcode':        vcode,
    'data-mpsreturnurl':    `${opts.baseUrl}/return`,
    'data-mpscallbackurl':  `${opts.baseUrl}/api/fiuu/callback`,
    'data-mpsnotifyurl':    `${opts.baseUrl}/api/fiuu/callback`,
  };

  return { scriptUrl, attrs };
}

import crypto from 'crypto';

function md5(v: string) {
  return crypto.createHash('md5').update(v).digest('hex');
}

export function verifyFiuuCallback(body: Record<string, string>): boolean {
  const secretKey = process.env.FIUU_SECRET_KEY;
  if (!secretKey) throw new Error('FIUU_SECRET_KEY not set');
  const { tranID, orderID, status, domain, amount, currency, paydate, skey } = body;
  const raw = `${tranID}${orderID}${status}${domain}${amount}${currency}${paydate}${secretKey}`;
  return md5(md5(raw)) === skey;
}

export function isFiuuSuccess(status: string) {
  return status === '00';
}

export function buildFiuuParams(opts: {
  sessionId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  description: string;
  baseUrl: string;
}): Record<string, string> {
  const merchantId = process.env.FIUU_MERCHANT_ID;
  const verifyKey  = process.env.FIUU_VERIFY_KEY;
  if (!merchantId || !verifyKey) throw new Error('FIUU_MERCHANT_ID and FIUU_VERIFY_KEY must be set');

  const amountStr = opts.amount.toFixed(2);
  // vcode = md5(amount + merchantId + orderid + md5(verifyKey))
  const vcode = md5(amountStr + merchantId + opts.sessionId + md5(verifyKey));

  return {
    merchant_id:  merchantId,
    orderid:      opts.sessionId,
    amount:       amountStr,
    bill_name:    opts.customerName,
    bill_email:   opts.customerEmail,
    bill_mobile:  opts.customerPhone,
    bill_desc:    opts.description,
    country:      'MY',
    currency:     'MYR',
    returnurl:    `${opts.baseUrl}/return`,
    callbackurl:  `${opts.baseUrl}/api/fiuu/callback`,
    cancelurl:    `${opts.baseUrl}/checkout?cancelled=1`,
    vcode,
    lang:         'UTF-8',
  };
}

export const FIUU_PAYMENT_URL = 'https://payment.fiuu.com/pay';

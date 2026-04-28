import crypto from 'crypto';

function md5(v: string) {
  return crypto.createHash('md5').update(v).digest('hex');
}

export function verifyFiuuCallback(body: Record<string, string>): boolean {
  const secretKey = process.env.FIUU_SECRET_KEY;
  const verifyKey = process.env.FIUU_VERIFY_KEY;
  if (!secretKey) throw new Error('FIUU_SECRET_KEY not set');
  const { tranID, orderID, status, domain, amount, currency, paydate, skey } = body;
  const base = `${tranID}${orderID}${status}${domain}${amount}${currency}${paydate}`;

  // Try all known Fiuu formula variants to identify the correct one
  const variants: Record<string, string> = {
    'md5(md5(base+secretKey))':        md5(md5(base + secretKey)),
    'md5(base+md5(secretKey))':        md5(base + md5(secretKey)),
    'md5(md5(base+verifyKey))':        md5(md5(base + (verifyKey ?? ''))),
    'md5(base+md5(verifyKey))':        md5(base + md5(verifyKey ?? '')),
  };

  const mask = (k: string) => k ? `${k.slice(0,4)}...${k.slice(-4)} (len ${k.length})` : 'MISSING';
  console.log('[fiuu/verify] secretKey:', mask(secretKey), '| verifyKey:', mask(verifyKey ?? ''));
  console.log('[fiuu/verify] skey from Fiuu:', skey);
  for (const [label, computed] of Object.entries(variants)) {
    console.log(`[fiuu/verify] ${label} =`, computed, computed === skey ? '✓ MATCH' : '');
  }

  return Object.values(variants).some(v => v === skey);
}

export function isFiuuSuccess(status: string) {
  return status === '00';
}

export function buildFiuuRedirectUrl(opts: {
  sessionId: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  baseUrl: string;
}): string {
  const merchantId = process.env.FIUU_MERCHANT_ID;
  const verifyKey  = process.env.FIUU_VERIFY_KEY;
  const fiuuBase   = process.env.FIUU_BASE_URL ?? 'https://payment.fiuu.com';
  if (!merchantId || !verifyKey) throw new Error('FIUU_MERCHANT_ID and FIUU_VERIFY_KEY must be set');

  const amountStr = opts.amount.toFixed(2);
  const currency  = opts.currency ?? 'MYR';
  const method    = opts.paymentMethod ?? 'ALL';

  // vcode = md5(orderID + amount + currency + verifyKey)
  const vcode = md5(opts.sessionId + amountStr + currency + verifyKey);

  const params = new URLSearchParams({
    orderid:   opts.sessionId,
    amount:    amountStr,
    currency,
    vcode,
    returnurl: `${opts.baseUrl}/return`,
    notifyurl: `${opts.baseUrl}/api/fiuu/callback`,
  });

  return `${fiuuBase}/RMS/pay/${merchantId}/${method}?${params.toString()}`;
}

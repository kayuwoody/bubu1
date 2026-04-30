// Passthrough for Fiuu Seamless SDK (role="molpayseamless" form pattern).
// The SDK POSTs the form body here; we fetch mpslinkkey server-side (no CORS),
// then return the full JSON the SDK expects to proceed with payment.
export const dynamic = 'force-dynamic';

async function discoverSdkUrls(fiuuBase: string): Promise<void> {
  // Fetch the SDK JS file server-side (no browser CORS) and log any URL
  // patterns containing "verify", "token", or "linkkey" so we can find
  // the correct mpslinkkey endpoint.
  try {
    const sdkPath = fiuuBase.includes('sandbox')
      ? '/MOLPay/API/seamless/3.28/js/MOLPay_seamless_sandbox.deco.js'
      : '/MOLPay/API/seamless/3.28/js/MOLPay_seamless.deco.js';
    const res = await fetch(`${fiuuBase}${sdkPath}`, {
      headers: { 'Referer': fiuuBase + '/', 'User-Agent': 'Mozilla/5.0' },
    });
    console.log('[sdk-discover] status:', res.status);
    if (!res.ok) return;
    const text = await res.text();
    // Extract all quoted strings that look like URL paths
    const hits = [...text.matchAll(/["'](\/[^"']{5,80}(?:verify|token|linkkey)[^"']*?)["']/gi)]
      .map(m => m[1]);
    console.log('[sdk-discover] url patterns:', JSON.stringify([...new Set(hits)].slice(0, 20)));
  } catch (e) {
    console.error('[sdk-discover] error:', e instanceof Error ? e.message : e);
  }
}

export async function POST(req: Request) {
  const text = await req.text();
  const body = Object.fromEntries(new URLSearchParams(text));
  console.log('[checkout/mps] received:', JSON.stringify(body));

  const fiuuBase = process.env.FIUU_BASE_URL ?? 'https://pay.fiuu.com';

  // One-time SDK URL discovery — logs URL patterns inside the SDK file so we
  // can find the correct mpslinkkey endpoint. Remove once endpoint is known.
  await discoverSdkUrls(fiuuBase);

  // Fetch mpslinkkey server-side; try known candidates in order.
  // We'll remove this trial loop once the correct endpoint is confirmed.
  let mpslinkkey = '';
  const candidates = [
    `${fiuuBase}/RMS/API/seamless/v2/index.php`,
    `${fiuuBase}/RMS/API/seamless/token.php`,
    `${fiuuBase}/MOLPay/API/seamless/token.php`,
  ];
  const qParams = new URLSearchParams({
    domain:               body.mpsmerchantid ?? '',
    key:                  body.mpsvcode ?? '',
    requestType:          'STYPE',
    ignoreInitialization: '0',
  });

  for (const base of candidates) {
    try {
      const url = `${base}?${qParams}`;
      console.log('[checkout/mps] probe →', url);
      const vRes  = await fetch(url);
      const vText = await vRes.text();
      console.log('[checkout/mps] probe ←', vRes.status, vText.slice(0, 200));
      if (vRes.ok) {
        try {
          const vData = JSON.parse(vText);
          mpslinkkey = vData.mpslinkkey ?? vData.token ?? '';
        } catch {
          const m = vText.match(/mpslinkkey=([^&\s]+)/);
          if (m) mpslinkkey = m[1];
        }
        if (mpslinkkey) break;
      }
    } catch (e) {
      console.error('[checkout/mps] probe error:', e instanceof Error ? e.message : e);
    }
  }

  console.log('[checkout/mps] mpslinkkey:', mpslinkkey ? `${mpslinkkey.slice(0, 8)}… (len ${mpslinkkey.length})` : 'EMPTY');

  return new Response(JSON.stringify({ ...body, status: true, mpslinkkey }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

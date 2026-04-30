// Passthrough for Fiuu Seamless SDK (role="molpayseamless" form pattern).
// The SDK POSTs the form body here; we fetch mpslinkkey server-side (no CORS),
// then return the full JSON the SDK expects to proceed with payment.
export const dynamic = 'force-dynamic';

async function discoverSdkUrls(fiuuBase: string): Promise<void> {
  // Fetch the SDK JS file server-side (no browser CORS) and log any URL
  // patterns so we can find the correct mpslinkkey endpoint.
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
    // Broad search: any quoted string containing a slash and at least one alpha segment
    const allPaths = [...text.matchAll(/["'](\/[A-Za-z][A-Za-z0-9/_.-]{8,120})["']/g)]
      .map(m => m[1]).filter(p => !p.includes(' '));
    console.log('[sdk-discover] all paths:', JSON.stringify([...new Set(allPaths)].slice(0, 30)));
    // Also log raw 200-char segments near the word "token" or "verify"
    const keyIdx = [...text.matchAll(/(?:token|linkkey|verify)/gi)].map(m => m.index!);
    for (const idx of keyIdx.slice(0, 5)) {
      console.log('[sdk-discover] context:', JSON.stringify(text.slice(Math.max(0, idx-60), idx+140)));
    }
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

  // All known verify endpoints 404. Test whether mpslinkkey just needs to be
  // non-empty: use vcode as a stand-in. If P03 clears → mpslinkkey is the issue
  // and the correct formula/endpoint still needs to be found.
  // If P03 persists → something else is wrong and mpslinkkey is a red herring.
  let mpslinkkey = body.mpsvcode ?? '';

  console.log('[checkout/mps] mpslinkkey:', mpslinkkey ? `${mpslinkkey.slice(0, 8)}… (len ${mpslinkkey.length})` : 'EMPTY');

  return new Response(JSON.stringify({ ...body, status: true, mpslinkkey }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

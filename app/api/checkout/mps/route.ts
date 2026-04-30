// Passthrough for Fiuu Seamless SDK (role="molpayseamless" form pattern).
// The SDK POSTs the form body here; we fetch mpslinkkey server-side (no CORS),
// then return the full JSON the SDK expects to proceed with payment.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const text = await req.text();
  const body = Object.fromEntries(new URLSearchParams(text));
  console.log('[checkout/mps] received:', JSON.stringify(body));

  // Fetch mpslinkkey from Fiuu's verify endpoint server-side to avoid CORS.
  // The SDK expects this token in the JSON response before it can call index.php.
  let mpslinkkey = '';
  try {
    const fiuuBase = process.env.FIUU_BASE_URL ?? 'https://pay.fiuu.com';
    const params = new URLSearchParams({
      domain:               body.mpsmerchantid ?? '',
      key:                  body.mpsvcode ?? '',
      requestType:          'STYPE',
      ignoreInitialization: '0',
    });
    const verifyUrl = `${fiuuBase}/MOLPay/API/seamless/verify?${params}`;
    console.log('[checkout/mps] verify →', verifyUrl);
    const vRes  = await fetch(verifyUrl);
    const vText = await vRes.text();
    console.log('[checkout/mps] verify ←', vRes.status, vText.slice(0, 300));
    try {
      const vData = JSON.parse(vText);
      mpslinkkey = vData.mpslinkkey ?? vData.token ?? '';
    } catch {
      // Some Fiuu endpoints return plain text or key=value pairs
      const m = vText.match(/mpslinkkey=([^&\s]+)/);
      if (m) mpslinkkey = m[1];
    }
  } catch (e) {
    console.error('[checkout/mps] verify error:', e instanceof Error ? e.message : e);
  }

  console.log('[checkout/mps] mpslinkkey:', mpslinkkey ? `${mpslinkkey.slice(0, 8)}… (len ${mpslinkkey.length})` : 'EMPTY');

  // status: true must be boolean (form encoding produces string "true" which
  // fails the SDK's strict === true check)
  return new Response(JSON.stringify({ ...body, status: true, mpslinkkey }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

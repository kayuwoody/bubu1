// Passthrough for Fiuu Seamless SDK (role="molpayseamless" form pattern).
// The SDK POSTs the form body here and reads the JSON we return to build
// the payment request to index.php.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const text = await req.text();
  const body = Object.fromEntries(new URLSearchParams(text));
  console.log('[checkout/mps] received:', JSON.stringify(body));

  // status: true must be boolean — form encoding produces string "true" which
  // fails the SDK's strict === true check.
  return new Response(JSON.stringify({ ...body, status: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

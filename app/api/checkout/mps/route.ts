// Passthrough endpoint for the Fiuu Seamless SDK (role="molpayseamless" form pattern).
// The SDK POSTs the form body here (form-encoded); we return it as the JSON the SDK expects.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const text = await req.text();
  const body = Object.fromEntries(new URLSearchParams(text));
  console.log('[checkout/mps] received:', JSON.stringify(body));
  // Spread body first, then override status with boolean true so the SDK's
  // strict `=== true` check passes (form encoding turns the boolean into "true" string)
  return new Response(JSON.stringify({ ...body, status: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

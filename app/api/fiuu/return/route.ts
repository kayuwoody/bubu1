// Fiuu POSTs return data here after payment (form POST redirect).
// We convert it to a GET redirect so the /return page can read params from the URL.
export const dynamic = 'force-dynamic';

function toUuid(raw: string): string {
  // Fiuu strips hyphens from the orderid; reconstruct standard UUID format
  // so the /api/checkout/[sessionId] Supabase query matches the stored UUID.
  if (raw.length === 32 && /^[0-9a-f]+$/i.test(raw)) {
    return `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`;
  }
  return raw;
}

export async function POST(req: Request) {
  const text = await req.text();
  const body = Object.fromEntries(new URLSearchParams(text));
  console.log('[fiuu/return] POST params:', JSON.stringify(body));

  const rawOrder = body.orderid ?? body.orderID ?? '';
  const params = new URLSearchParams();
  params.set('orderID', toUuid(rawOrder));
  if (body.status   || body.Status)   params.set('status',  body.status  ?? body.Status  ?? '');
  if (body.tranID   || body.TranID)   params.set('tranID',  body.tranID  ?? body.TranID  ?? '');
  if (body.appcode  || body.Appcode)  params.set('appcode', body.appcode ?? body.Appcode ?? '');
  if (body.error_code) params.set('error_code', body.error_code);

  return Response.redirect(new URL(`/return?${params}`, req.url), 303);
}

// Allow GET too (Fiuu occasionally probes the URL)
export async function GET(req: Request) {
  return Response.redirect(new URL('/return', req.url), 302);
}

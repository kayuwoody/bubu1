// Fiuu POSTs return data here after payment (form POST redirect).
// We convert it to a GET redirect so the /return page can read params from the URL.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const text = await req.text();
  const body = Object.fromEntries(new URLSearchParams(text));
  console.log('[fiuu/return] POST params:', JSON.stringify(body));

  const params = new URLSearchParams();
  // Forward the fields the /return page needs
  if (body.orderid  || body.orderID)  params.set('orderID', body.orderid ?? body.orderID ?? '');
  if (body.status   || body.Status)   params.set('status',  body.status  ?? body.Status  ?? '');
  if (body.tranID   || body.TranID)   params.set('tranID',  body.tranID  ?? body.TranID  ?? '');
  if (body.amount   || body.Amount)   params.set('amount',  body.amount  ?? body.Amount  ?? '');
  if (body.domain   || body.Domain)   params.set('domain',  body.domain  ?? body.Domain  ?? '');
  if (body.appcode  || body.Appcode)  params.set('appcode', body.appcode ?? body.Appcode ?? '');
  if (body.error_code) params.set('error_code', body.error_code);

  return Response.redirect(new URL(`/return?${params}`, req.url), 303);
}

// Allow GET too (Fiuu occasionally probes the URL)
export async function GET(req: Request) {
  return Response.redirect(new URL('/return', req.url), 302);
}

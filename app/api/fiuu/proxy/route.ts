// Generic server-side proxy for Fiuu AJAX calls that are CORS-blocked in the browser.
// The checkout page sets up $.ajaxPrefilter to route all Fiuu-domain requests here.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let payload: { url: string; method: string; body?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  const { url, method = 'GET', body = '' } = payload;
  console.log('[fiuu/proxy] →', method, url, body ? `body(${body.length}b): ${body.slice(0, 200)}` : '(no body)');

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
      body: body || undefined,
    });
  } catch (e) {
    console.error('[fiuu/proxy] fetch error:', e instanceof Error ? e.message : e);
    return new Response('proxy fetch failed', { status: 502 });
  }

  const text = await res.text();
  console.log('[fiuu/proxy] ←', res.status, text.slice(0, 300));

  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'text/plain' },
  });
}

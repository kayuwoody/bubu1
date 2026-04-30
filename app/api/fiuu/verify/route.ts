// Server-side proxy for Fiuu /RMS/verify — avoids CORS when called from the browser.
// The Fiuu Seamless SDK makes an AJAX call to this endpoint to obtain mpslinkkey.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FIUU_BASE = process.env.FIUU_BASE_URL ?? 'https://pay.fiuu.com';
const VERIFY_URL = `${FIUU_BASE}/RMS/verify`;

async function proxy(req: Request) {
  const body = await req.text();
  const headers: Record<string, string> = { 'Content-Type': req.headers.get('Content-Type') ?? 'application/x-www-form-urlencoded' };

  let res: Response;
  try {
    res = await fetch(VERIFY_URL, { method: 'POST', headers, body: body || `mpsmerchantid=${encodeURIComponent(process.env.FIUU_MERCHANT_ID ?? '')}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'proxy error';
    console.error('[fiuu/verify] fetch error:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const text = await res.text();
  console.log('[fiuu/verify] upstream status:', res.status, 'body:', text.slice(0, 200));

  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'text/plain' },
  });
}

export async function POST(req: Request) { return proxy(req); }
export async function GET(req: Request) { return proxy(req); }

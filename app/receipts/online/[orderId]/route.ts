import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { orderId: string } }
) {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return new NextResponse('Server misconfigured', { status: 500 });

  const storageUrl = `${supabaseUrl}/storage/v1/object/public/receipts/online-order-${params.orderId}.html`;
  const res = await fetch(storageUrl, { cache: 'no-store' });

  if (!res.ok) return new NextResponse('Receipt not found', { status: 404 });

  const html = await res.text();
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const INK = '#3A2414';
const PRI = '#F58220';
const BG  = '#FFF6E8';

export default function ReturnPage() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const orderID     = searchParams.get('orderID') ?? searchParams.get('orderid') ?? '';
  const status      = searchParams.get('status') ?? '';

  const [message, setMessage] = useState('Confirming your payment…');
  const [failed,  setFailed]  = useState(false);

  useEffect(() => {
    if (!orderID) { setFailed(true); setMessage('Missing order reference.'); return; }
    if (status && status !== '00') { setFailed(true); setMessage('Payment was not completed.'); return; }

    let attempts = 0;
    const MAX = 12; // ~24 seconds

    const poll = async () => {
      attempts++;
      try {
        const res  = await fetch(`/api/checkout/${orderID}`);
        const data = await res.json();

        if (data.order_id) {
          localStorage.removeItem('co_pending');
          localStorage.removeItem('co_session');
          router.replace(`/order/${data.order_id}`);
          return;
        }

        if (data.status === 'failed') {
          setFailed(true);
          setMessage('Payment failed. Please try again.');
          return;
        }
      } catch { /* network blip — keep polling */ }

      if (attempts >= MAX) {
        setFailed(true);
        setMessage('Taking longer than expected. Please check your email or contact us.');
        return;
      }

      setTimeout(poll, 2000);
    };

    poll();
  }, [orderID, status, router]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: BG, fontFamily: "'Nunito', system-ui", padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        {failed ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 22, color: INK, marginBottom: 8 }}>
              Something went wrong
            </div>
            <div style={{ fontSize: 15, color: INK, opacity: .7, marginBottom: 24 }}>{message}</div>
            <a href="/checkout" style={{
              display: 'inline-block', padding: '14px 28px',
              background: PRI, color: '#fff', borderRadius: 999,
              fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 15,
              textDecoration: 'none',
            }}>Try again</a>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="28" r="28" fill={PRI} opacity=".15"/>
                <circle cx="28" cy="28" r="20" fill={PRI}/>
                <path d="M18 28l7 7 13-14" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 22, color: INK, marginBottom: 8 }}>
              Payment received!
            </div>
            <div style={{ fontSize: 15, color: INK, opacity: .7 }}>{message}</div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 6 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%', background: PRI,
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}/>
              ))}
            </div>
          </>
        )}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

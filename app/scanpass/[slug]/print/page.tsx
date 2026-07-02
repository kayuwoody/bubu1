'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';

const INK     = '#3A2414';
const PRI     = '#F58220';
const MASCOT  = 'https://82fs0epyy9esp8a5.public.blob.vercel-storage.com/assets/binbean.webp';
const LOGO    = 'https://82fs0epyy9esp8a5.public.blob.vercel-storage.com/assets/co-logo.webp';
const SITE    = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://coffee-oasis.com';

function PrintContent() {
  const params = useParams();
  const slug   = (params?.slug as string) ?? '';

  const [pass, setPass] = useState<{ name: string; description: string | null; pass_type: string } | null>(null);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/scanpass/${slug}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setPass(d.pass); })
      .catch(() => setError('Could not load pass'));
  }, [slug]);

  const claimUrl = `${SITE}/scanpass/${slug}`;
  const isStamp  = pass?.pass_type === 'stamp';

  const downloadQR = () => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `qr-${slug}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@800;900&family=Nunito:wght@600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #f5efe8; font-family: 'Nunito', system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          body { background: #fff; }
          .no-print { display: none !important; }
          .card { box-shadow: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ textAlign: 'center', padding: '20px 16px 0', display: 'flex', justifyContent: 'center', gap: 10 }}>
        <button
          onClick={() => window.print()}
          style={{ background: PRI, color: '#fff', border: 'none', borderRadius: 999, padding: '10px 28px', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: "'Nunito',system-ui" }}
        >
          Print / Save as PDF
        </button>
        <button
          onClick={downloadQR}
          style={{ background: INK, color: '#fff', border: 'none', borderRadius: 999, padding: '10px 28px', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: "'Nunito',system-ui" }}
        >
          Download QR PNG
        </button>
      </div>

      {/* Hidden high-res canvas for download — 800px for crisp printing */}
      <div ref={canvasRef} style={{ position: 'absolute', left: -9999, top: -9999, visibility: 'hidden' }}>
        <QRCodeCanvas value={claimUrl} size={800} bgColor="#ffffff" fgColor={INK} level="H" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 16px 48px' }}>
        <div className="card" style={{ background: '#fff', borderRadius: 24, width: 380, overflow: 'hidden', boxShadow: '0 8px 40px rgba(58,36,20,.18)', border: `2.5px solid ${PRI}` }}>

          {/* Header */}
          <div style={{ background: `linear-gradient(135deg, ${PRI} 0%, #FF9A3D 100%)`, padding: '28px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <img src={MASCOT} alt="" style={{ width: 90, height: 90, objectFit: 'contain', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.22))' }} />
            <img src={LOGO} alt="Coffee Oasis" style={{ height: 32, objectFit: 'contain' }} />
          </div>

          {/* Pass name + description */}
          <div style={{ background: INK, padding: '18px 24px', textAlign: 'center' }}>
            {error ? (
              <div style={{ fontFamily: "'Nunito',system-ui", fontSize: 14, color: 'rgba(255,255,255,.6)' }}>{error}</div>
            ) : pass ? (
              <>
                <div style={{ fontFamily: "'Baloo 2',system-ui", fontWeight: 900, fontSize: 24, color: '#fff', lineHeight: 1.15, marginBottom: 4 }}>
                  {pass.name}
                </div>
                {pass.description && (
                  <div style={{ fontFamily: "'Nunito',system-ui", fontSize: 13, color: 'rgba(255,255,255,.75)', lineHeight: 1.5 }}>
                    {pass.description}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontFamily: "'Nunito',system-ui", fontSize: 14, color: 'rgba(255,255,255,.5)' }}>Loading…</div>
            )}
          </div>

          {/* QR code */}
          <div style={{ padding: '28px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ background: '#FFF6E8', borderRadius: 18, padding: 18, border: `2.5px solid ${PRI}` }}>
              <QRCodeSVG value={claimUrl} size={210} bgColor="#FFF6E8" fgColor={INK} level="M" />
            </div>

            <div style={{ fontFamily: "'Baloo 2',system-ui", fontWeight: 800, fontSize: 16, color: INK, textAlign: 'center' }}>
              {isStamp ? 'Scan to earn your stamp' : 'Scan to claim your offer'}
            </div>

            <div style={{ fontFamily: "'Nunito',system-ui", fontSize: 12, color: 'rgba(58,36,20,.45)', textAlign: 'center', wordBreak: 'break-all' }}>
              {claimUrl}
            </div>

            {/* Instruction strip */}
            <div style={{ width: '100%', background: '#FFF6E8', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-around' }}>
              {(isStamp
                ? [['📱', 'Scan QR'], ['🔢', 'Enter phone'], ['✦', 'Earn stamp']]
                : [['📱', 'Scan QR'], ['🔢', 'Enter phone'], ['🎁', 'Get offer']]
              ).map(([icon, label]) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <span style={{ fontFamily: "'Nunito',system-ui", fontWeight: 700, fontSize: 11, color: INK, textAlign: 'center' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ScanPassPrintPage() {
  return (
    <Suspense>
      <PrintContent />
    </Suspense>
  );
}

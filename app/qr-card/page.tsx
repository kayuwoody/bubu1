'use client';

import { QRCodeSVG } from 'qrcode.react';

const SITE_URL    = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://coffee-oasis.com';
const MASCOT_URL  = 'https://82fs0epyy9esp8a5.public.blob.vercel-storage.com/assets/binbean.webp';
const LOGO_URL    = 'https://82fs0epyy9esp8a5.public.blob.vercel-storage.com/assets/co-logo.webp';

export default function QrCardPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #f5efe8; font-family: 'Nunito', system-ui, sans-serif; }
        @media print {
          body { background: #fff; }
          .no-print { display: none !important; }
          .card { box-shadow: none !important; page-break-inside: avoid; }
        }
      `}</style>

      {/* Print button */}
      <div className="no-print" style={{ textAlign:'center', padding:'24px 16px 0' }}>
        <button
          onClick={() => window.print()}
          style={{ background:'#F58220', color:'#fff', border:'none', borderRadius:999, padding:'10px 28px', fontWeight:700, fontSize:15, cursor:'pointer', fontFamily:"'Nunito',system-ui" }}>
          Print / Save as PDF
        </button>
      </div>

      {/* Card */}
      <div style={{ display:'flex', justifyContent:'center', padding:'28px 16px 48px' }}>
        <div
          className="card"
          style={{
            background:'#fff',
            borderRadius:24,
            width:360,
            overflow:'hidden',
            boxShadow:'0 8px 40px rgba(58,36,20,.18)',
            border:'2px solid #F58220',
          }}
        >
          {/* Header band */}
          <div style={{ background:'linear-gradient(135deg,#F58220 0%,#FF9A3D 100%)', padding:'28px 24px 22px', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
            <img
              src={MASCOT_URL}
              alt="Coffee Oasis mascot"
              style={{ width:100, height:100, objectFit:'contain', filter:'drop-shadow(0 4px 10px rgba(0,0,0,.22))' }}
            />
            <img
              src={LOGO_URL}
              alt="Coffee Oasis"
              style={{ height:36, objectFit:'contain' }}
            />
            <div style={{ fontFamily:"'Nunito',system-ui", fontWeight:700, fontSize:14, color:'rgba(255,255,255,.92)', letterSpacing:'.03em', textAlign:'center' }}>
              Skip the queue. Order from your phone.
            </div>
          </div>

          {/* QR section */}
          <div style={{ padding:'28px 24px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
            <div style={{ background:'#FFF6E8', borderRadius:16, padding:16, border:'2px solid #F58220' }}>
              <QRCodeSVG
                value={SITE_URL}
                size={200}
                bgColor="#FFF6E8"
                fgColor="#3A2414"
                level="M"
              />
            </div>

            <div style={{ fontFamily:"'Nunito',system-ui", fontWeight:800, fontSize:15, color:'#3A2414', textAlign:'center' }}>
              Scan to order now
            </div>

            <div style={{ fontFamily:"'Nunito',system-ui", fontSize:13, color:'rgba(58,36,20,.55)', textAlign:'center', letterSpacing:'.01em' }}>
              {SITE_URL}
            </div>

            {/* Benefits strip */}
            <div style={{ width:'100%', background:'#FFF6E8', borderRadius:12, padding:'12px 16px', display:'flex', justifyContent:'space-around', marginTop:4 }}>
              {[['☕','Order ahead'],['🎁','Earn rewards'],['🚗','Curbside pickup']].map(([icon, label]) => (
                <div key={label} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <span style={{ fontSize:22 }}>{icon}</span>
                  <span style={{ fontFamily:"'Nunito',system-ui", fontWeight:700, fontSize:11, color:'#3A2414', textAlign:'center' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { pushSupported, isIOSNotStandalone, isSubscribed, subscribeStaff, sendTestPush } from '@/lib/pushClient';

const PRI = '#F58220';
const BG  = '#FFF6E8';
const INK = '#3A2414';

function hex(c: string, a: number) {
  const n = c.replace('#', '');
  return `rgba(${parseInt(n.slice(0,2),16)},${parseInt(n.slice(2,4),16)},${parseInt(n.slice(4,6),16)},${a})`;
}

export default function StaffAlertsPage() {
  const [passcode, setPasscode] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'on'>('idle');
  const [msg, setMsg] = useState('');
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => {
    if (pushSupported()) isSubscribed().then(s => { if (s) setState('on'); });
  }, []);

  const enable = async () => {
    setMsg('');
    if (isIOSNotStandalone()) { setMsg('On iPhone: add this page to your home screen first, then open the installed app and try again.'); return; }
    if (!pushSupported()) { setMsg('This browser can’t receive notifications.'); return; }
    setState('loading');
    const r = await subscribeStaff(passcode.trim());
    if (r === 'ok') { setState('on'); setMsg(''); }
    else {
      setState('idle');
      setMsg(r === 'passcode' ? 'Incorrect passcode.' : r === 'denied' ? 'Notification permission was blocked — enable it in browser settings.' : 'Could not enable alerts. Try again.');
    }
  };

  const test = async () => {
    setTestMsg('Sending…');
    const r = await sendTestPush();
    setTestMsg(r === 'ok' ? 'Sent — check your notifications' : 'Failed to send');
    setTimeout(() => setTestMsg(''), 4000);
  };

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '28px 16px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <h1 style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 24, color: INK, margin: '0 0 6px' }}>
          🛎️ New-order alerts
        </h1>
        <p style={{ fontFamily: "'Nunito', system-ui", fontSize: 14.5, color: hex(INK, .65), lineHeight: 1.5, marginTop: 0 }}>
          Get a notification on this phone whenever an online order comes in. Enter the staff
          passcode and enable alerts. You can enable it on more than one phone.
        </p>

        {state === 'on' ? (
          <div style={{ background: '#fff', border: `1.5px solid ${hex(INK, .1)}`, borderRadius: 16, padding: 18, marginTop: 12 }}>
            <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 16, color: '#16A34A' }}>✓ Alerts are on for this phone</div>
            <button onClick={test} style={{ marginTop: 12, width: '100%', padding: 11, borderRadius: 10, background: 'transparent', border: `1px dashed ${hex(INK, .25)}`, color: hex(INK, .6), fontFamily: "'Nunito', system-ui", fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {testMsg || 'Send a test notification'}
            </button>
          </div>
        ) : (
          <div style={{ background: '#fff', border: `1.5px solid ${hex(INK, .1)}`, borderRadius: 16, padding: 18, marginTop: 12 }}>
            <label style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 13, color: INK }}>Staff passcode</label>
            <input
              type="password"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              placeholder="Enter passcode"
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '12px 14px', fontFamily: "'Nunito', system-ui", fontSize: 15, color: INK, background: BG, border: `1.5px solid ${hex(INK, .12)}`, borderRadius: 10, outline: 'none' }}
            />
            <button onClick={enable} disabled={state === 'loading' || !passcode.trim()} style={{ marginTop: 12, width: '100%', padding: 13, borderRadius: 10, background: PRI, color: '#fff', border: 'none', fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: passcode.trim() ? 1 : .6 }}>
              {state === 'loading' ? 'Enabling…' : 'Enable order alerts'}
            </button>
          </div>
        )}

        {msg && <div style={{ marginTop: 12, fontFamily: "'Nunito', system-ui", fontSize: 13.5, color: hex(INK, .7), lineHeight: 1.5 }}>{msg}</div>}
      </div>
    </div>
  );
}

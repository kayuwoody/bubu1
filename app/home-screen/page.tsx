import Link from 'next/link';

const PRI = '#F58220';
const BG  = '#FFF6E8';
const INK = '#3A2414';

export const metadata = {
  title: 'Add to Home Screen — Coffee Oasis',
  description: 'What the Coffee Oasis home-screen icon is, what it does, and what it does not do.',
};

function hex(c: string, a: number) {
  const n = c.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: '#fff', border: `1.5px solid ${hex(INK, .08)}`, borderRadius: 18, padding: '18px 20px', marginBottom: 14 }}>
      <h2 style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 18, color: INK, margin: '0 0 8px' }}>{title}</h2>
      <div style={{ fontFamily: "'Nunito', system-ui", fontSize: 15, color: hex(INK, .75), lineHeight: 1.6 }}>{children}</div>
    </section>
  );
}

export default function HomeScreenInfo() {
  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <img src="/co-mascot.png" alt="" style={{ width: 56, height: 56, objectFit: 'contain' }} />
          <h1 style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 24, color: INK, margin: 0, lineHeight: 1.15 }}>
            Adding Coffee Oasis to your home screen
          </h1>
        </div>

        <Card title="What it is">
          It’s our website, with a shortcut icon on your home screen so you can open it
          in one tap — no typing the address each time. On Android your phone may call
          this “installing an app”; it’s the same web page you’re on now, just launched
          from an icon.
        </Card>

        <Card title="What it does">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Opens full-screen, without the browser bars, so ordering feels quicker.</li>
            <li>Puts our icon on your home screen for one-tap access.</li>
            <li>If you choose to turn them on, it can send you a notification when your
              order is ready — nothing is sent unless you opt in.</li>
          </ul>
        </Card>

        <Card title="What it does not do">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>It’s <strong>not</strong> from an app store, and there’s nothing large to download.</li>
            <li>It <strong>can’t</strong> see your contacts, photos, files, or location, and it
              doesn’t track you in the background.</li>
            <li>It doesn’t run when you’re not using it (aside from delivering a
              ready-notification, only if you opted in).</li>
            <li>It asks permission for notifications — and never turns them on by itself.</li>
          </ul>
        </Card>

        <Card title="The information we use">
          Only what you give us to place an order — your name and phone number (and email
          if you add one) — plus your loyalty stamps and vouchers. The same as using the
          website in a browser. Adding the icon doesn’t share anything extra.
        </Card>

        <Card title="Removing it">
          Press and hold the icon and choose Remove / Uninstall — exactly like any other
          home-screen icon. That’s all; nothing is left behind.
        </Card>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link href="/" style={{ display: 'inline-block', background: PRI, color: '#fff', textDecoration: 'none', fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 15, padding: '12px 22px', borderRadius: 999 }}>
            ← Back to menu
          </Link>
        </div>
      </div>
    </div>
  );
}

// Client-side web-push helpers. Safe to import in 'use client' components.

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
    && !!VAPID_PUBLIC;
}

// iOS only allows web push when the site is installed to the home screen.
export function isIOSNotStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const ios = /iphone|ipad|ipod/i.test(ua);
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch { return false; }
}

// Requests permission, subscribes, and registers the subscription server-side.
// Returns 'ok', 'denied' (permission), or 'error'.
export async function subscribeToPush(phone: string): Promise<'ok' | 'denied' | 'error'> {
  if (!pushSupported()) return 'error';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
      });
    }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, subscription: sub.toJSON() }),
    });
    return res.ok ? 'ok' : 'error';
  } catch (e) {
    console.error('[push] subscribe failed:', e);
    return 'error';
  }
}

// Registers THIS device as a staff subscriber (new-order alerts), gated by a
// passcode checked server-side. Returns 'ok', 'denied' (permission),
// 'passcode' (wrong passcode), or 'error'.
export async function subscribeStaff(passcode: string): Promise<'ok' | 'denied' | 'passcode' | 'error'> {
  if (!pushSupported()) return 'error';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
      });
    }

    const res = await fetch('/api/push/subscribe-staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode, subscription: sub.toJSON() }),
    });
    if (res.status === 401) return 'passcode';
    return res.ok ? 'ok' : 'error';
  } catch (e) {
    console.error('[push] staff subscribe failed:', e);
    return 'error';
  }
}

// TEMPORARY — sends a test push to this device only. Remove with the test UI.
export async function sendTestPush(): Promise<'ok' | 'error'> {
  if (!pushSupported()) return 'error';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return 'error';
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return res.ok ? 'ok' : 'error';
  } catch { return 'error'; }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
    return true;
  } catch (e) {
    console.error('[push] unsubscribe failed:', e);
    return false;
  }
}

import webpush from 'web-push';
import { supabase } from './supabase';

let configured = false;

// Configure web-push with VAPID keys once. Returns false if keys aren't set
// (so callers can no-op gracefully before the env is provisioned).
export function ensureVapid(): boolean {
  if (configured) return true;
  const publicKey  = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  let subject      = process.env.VAPID_SUBJECT || 'mailto:hello@coffee-oasis.com';
  if (!publicKey || !privateKey) return false;
  // web-push requires a mailto: or https: URL — tolerate a bare email in env
  if (!/^(mailto:|https?:)/i.test(subject)) subject = `mailto:${subject}`;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushSub {
  endpoint: string;
  p256dh:   string;
  auth:     string;
}

// Sends a push. Returns 'ok', or 'gone' if the subscription is dead (410/404)
// and should be pruned, or 'error' for anything else.
export async function sendPush(sub: PushSub, payload: Record<string, unknown>): Promise<'ok' | 'gone' | 'error'> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return 'ok';
  } catch (e: unknown) {
    const status = (e as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) return 'gone';
    console.error('[push] send error:', e instanceof Error ? e.message : e);
    return 'error';
  }
}

// Sends a push to every registered staff device (role = 'staff'), pruning dead
// subscriptions. Used to alert the merchant when a new online order comes in.
export async function sendToStaff(payload: Record<string, unknown>): Promise<{ sent: number; pruned: number }> {
  if (!ensureVapid()) return { sent: 0, pruned: 0 };
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('role', 'staff');
  if (!subs?.length) return { sent: 0, pruned: 0 };

  let sent = 0;
  const dead: string[] = [];
  for (const s of subs) {
    const r = await sendPush(s, payload);
    if (r === 'ok') sent++;
    else if (r === 'gone') dead.push(s.endpoint);
  }
  if (dead.length) await supabase.from('push_subscriptions').delete().in('endpoint', dead);
  return { sent, pruned: dead.length };
}

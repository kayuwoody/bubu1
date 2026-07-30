import { supabase } from './supabase';

// The welcome program is resolved by trigger_type, mirroring how the scan
// (check-in) and purchase voucher paths find their programs — no hardcoded
// UUID to break on a DB migration. CAVEAT: 'manual' is a catch-all bucket, so
// this assumes there is exactly one active 'manual' program (the welcome one).
// If a second manual program is ever added, this needs a discriminator.
export async function issueWelcomeVoucher(memberId: string): Promise<void> {
  try {
    const refId = `welcome:${memberId}`;

    const { data: existing } = await supabase
      .from('vouchers')
      .select('id')
      .eq('reference_id', refId)
      .maybeSingle();
    if (existing) return;

    const { data: progs } = await supabase
      .from('loyalty_programs')
      .select('voucher_type, voucher_discount_value, voucher_validity_days, voucher_min_order, is_active')
      .eq('trigger_type', 'manual')
      .eq('is_active', true)
      .order('sort_order');
    if (!progs?.length) return;
    if (progs.length > 1) console.warn('[welcome] multiple active manual programs; using lowest sort_order');
    const prog = progs[0];

    const now = new Date().toISOString();
    const code = `WEL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + (prog.voucher_validity_days ?? 30) * 86_400_000).toISOString();

    const { error } = await supabase.from('vouchers').insert({
      code,
      member_id:        memberId,
      is_active:        true,
      type:             prog.voucher_type,
      discount_value:   prog.voucher_discount_value,
      min_order_amount: prog.voucher_min_order ?? 0,
      expires_at:       expiresAt,
      times_used:       0,
      max_uses:         1,
      reference_id:     refId,
      created_at:       now,
    });
    if (error) console.error('[welcome] voucher insert error:', error.message);
    else console.log('[welcome] issued voucher', code, 'to member', memberId);
  } catch (e) {
    console.error('[welcome] unexpected error:', e);
  }
}

import { supabase } from './supabase';

// "Welcome" program — first-time members get a voucher per this program's config
const WELCOME_PROGRAM_ID = 'e6285398-021f-4f08-b4f2-50cac41d9cf4';

// Idempotent: safe to call on every member upsert; reference_id dedup ensures
// at most one welcome voucher per member.
export async function issueWelcomeVoucher(memberId: string): Promise<void> {
  try {
    const refId = `welcome:${memberId}`;

    const { data: existing } = await supabase
      .from('vouchers')
      .select('id')
      .eq('reference_id', refId)
      .maybeSingle();
    if (existing) return;

    const { data: prog } = await supabase
      .from('loyalty_programs')
      .select('voucher_type, voucher_discount_value, voucher_validity_days, voucher_min_order, is_active')
      .eq('id', WELCOME_PROGRAM_ID)
      .single();
    if (!prog || !prog.is_active) return;

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

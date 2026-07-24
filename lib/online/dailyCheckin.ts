import { supabase } from './supabase';

function todayMYT(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

export interface CheckinResult {
  already_claimed: boolean;
  program_name:    string;
  stamps_now:      number;
  threshold:       number;
  voucher_issued:  boolean;
  voucher?:        { code: string; type: string; value: number; expires_at: string };
}

// Award one daily check-in stamp on the active 'scan' program, deduped so a
// member earns at most one stamp per MYT day regardless of source (website
// visit, QR scan, or first purchase). The caller must have already upserted
// the member. Returns null when there is no active program or on error.
export async function awardDailyCheckin(
  memberId: string,
  phone: string,
  source: 'website' | 'order' | 'scan',
): Promise<CheckinResult | null> {
  const { data: programs } = await supabase
    .from('loyalty_programs')
    .select('id, name, threshold, voucher_type, voucher_discount_value, voucher_validity_days, voucher_min_order')
    .eq('trigger_type', 'scan')
    .eq('is_active', true);
  if (!programs?.length) return null;
  const prog = programs[0];

  const now = new Date().toISOString();
  const today = todayMYT();
  const [ty, tm, td] = today.split('-').map(Number);
  const startOfTodayMYT = new Date(Date.UTC(ty, tm - 1, td, -8, 0, 0)).toISOString();
  const refId = `${source === 'order' ? 'ord' : 'web'}:${phone}:${today}`;

  const { data: mp, error: mpErr } = await supabase
    .from('loyalty_member_programs')
    .upsert(
      { member_id: memberId, program_id: prog.id, updated_at: now },
      { onConflict: 'member_id,program_id', ignoreDuplicates: false },
    )
    .select('id, points_balance, total_earned')
    .single();
  if (mpErr || !mp) { console.error('[checkin] enrollment upsert error:', mpErr?.message); return null; }

  // Dedup: any stamp already awarded today (from any source) blocks a second one
  const { data: existingTx } = await supabase
    .from('loyalty_transactions')
    .select('id')
    .eq('member_id', memberId)
    .eq('program_id', prog.id)
    .gte('created_at', startOfTodayMYT)
    .limit(1)
    .maybeSingle();

  if (existingTx) {
    return { already_claimed: true, program_name: prog.name, stamps_now: mp.points_balance, threshold: prog.threshold, voucher_issued: false };
  }

  const newBalance       = mp.points_balance + 1;
  const vouchersToIssue  = Math.floor(newBalance / prog.threshold);
  const remainingBalance = newBalance % prog.threshold;

  await supabase.from('loyalty_member_programs').update({
    points_balance: remainingBalance,
    total_earned:   mp.total_earned + 1,
    updated_at:     now,
  }).eq('id', mp.id);

  await supabase.from('loyalty_transactions').insert({
    member_id:    memberId,
    program_id:   prog.id,
    type:         'earn_scan',
    points:       1,
    description:  source === 'order' ? 'Check-in (with order)' : 'Website check-in',
    reference_id: refId,
    created_at:   now,
  });

  let voucher: CheckinResult['voucher'];
  if (vouchersToIssue > 0) {
    const code = `VCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + prog.voucher_validity_days * 86_400_000).toISOString();
    const { data } = await supabase.from('vouchers').insert({
      code,
      member_id:        memberId,
      is_active:        true,
      type:             prog.voucher_type,
      discount_value:   prog.voucher_discount_value,
      min_order_amount: prog.voucher_min_order ?? 0,
      expires_at:       expiresAt,
      times_used:       0,
      max_uses:         1,
      created_at:       now,
      reference_id:     refId,
    }).select('code, type, discount_value, expires_at').single();
    if (data) voucher = { code: data.code, type: data.type, value: data.discount_value, expires_at: data.expires_at };
  }

  return {
    already_claimed: false,
    program_name:    prog.name,
    stamps_now:      remainingBalance,
    threshold:       prog.threshold,
    voucher_issued:  vouchersToIssue > 0,
    ...(voucher ? { voucher } : {}),
  };
}

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
  global: {
    // Prevent Next.js data cache from serving stale reads after writes
    fetch: (input, init) => fetch(input as RequestInfo, { ...init as RequestInit, cache: 'no-store' }),
  },
});

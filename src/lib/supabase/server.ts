import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

/** Session-bound client for server components. Still subject to RLS. */
export function supabaseServer() {
  const store = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: CookieToSet[]) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options as never)); } catch { /* called from a server component */ }
      },
    },
  });
}

/**
 * Service-role client. Server only. Used ONLY by the customer portal and public
 * business page routes, which call whitelisting SQL functions. Never import this
 * from a client component (the 'server-only' import enforces that at build time).
 */
export function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

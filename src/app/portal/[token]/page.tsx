import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase/server';
import { hashPortalToken, looksLikePortalToken } from '@/lib/portal-token';
import type { PortalResult } from '@/lib/portal-types';
import PortalView, { PortalProblem } from '@/components/portal/PortalView';

// Always render fresh: status, payments and expiry must be current on every visit.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your event', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function PortalPage({ params }: { params: { token: string } }) {
  const token = params.token;
  // Reject malformed tokens before touching the database.
  if (!looksLikePortalToken(token)) return <PortalProblem kind="invalid" />;
  let result: PortalResult;
  try {
    const { data, error } = await supabaseAdmin().rpc('get_portal', { p_token_hash: await hashPortalToken(token) });
    if (error || !data) return <PortalProblem kind="error" />;
    result = data as PortalResult;
  } catch {
    return <PortalProblem kind="error" />;
  }
  if (result.state !== 'ok') return <PortalProblem kind={result.state} />;
  return <PortalView data={result} />;
}

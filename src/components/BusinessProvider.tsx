'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Business } from '@/lib/types';
import { Skeleton, ErrorBox } from './ui';
import SubscriptionGate, { type Subscription } from './SubscriptionGate';

interface Ctx { business: Business; userId: string; userName: string; subscription: Subscription | null; hasAccess: boolean; userEmail: string; refresh: () => Promise<void> }
const BusinessContext = createContext<Ctx | null>(null);
export const useBusiness = () => {
  const c = useContext(BusinessContext);
  if (!c) throw new Error('useBusiness outside provider');
  return c;
};

export default function BusinessProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [state, setState] = useState<{ business: Business; userId: string; userName: string; userEmail: string; subscription: Subscription | null; hasAccess: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: member, error: mErr } = await sb.from('business_members').select('business_id').eq('user_id', user.id).limit(1).maybeSingle();
      if (mErr) throw mErr;
      if (!member) { if (window.location.pathname !== '/app/onboarding') router.replace('/app/onboarding'); setState(null); return; }
      const { data: biz, error: bErr } = await sb.from('businesses').select('*').eq('id', member.business_id).single();
      if (bErr) throw bErr;
      const { data: sub, error: sErr } = await sb.from('subscriptions').select('status, paid_until').eq('business_id', member.business_id).maybeSingle();
      if (sErr) throw sErr;
      const subscription = (sub as Subscription | null) ?? null;
      const hasAccess = !!subscription && subscription.status === 'active' && !!subscription.paid_until && new Date(subscription.paid_until) > new Date();
      setState({ business: biz as Business, userId: user.id, userName: (user.user_metadata?.full_name as string) || '', userEmail: user.email ?? '', subscription, hasAccess });
    } catch (e) {
      const reason = (e as { message?: string } | null)?.message;
      setError(reason ? `Unable to load your workspace. (${reason})` : 'Unable to load your workspace. Please try again.');
    }
  }, [router]);

  // Load once. After that, only reload when there is still no workspace (e.g. right after onboarding finishes).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!state) load(); }, [path]);

  if (path === '/app/onboarding') return <>{children}</>;
  if (error) return <div className="mx-auto max-w-md p-6"><ErrorBox message={error} onRetry={load} /></div>;
  if (!state) return <div className="mx-auto max-w-md space-y-4 p-6"><Skeleton className="h-10" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  if (!state.hasAccess) return <SubscriptionGate businessName={state.business.name} email={state.userEmail} subscription={state.subscription} onCheckAgain={load} />;
  return <BusinessContext.Provider value={{ ...state, refresh: load }}>{children}</BusinessContext.Provider>;
}

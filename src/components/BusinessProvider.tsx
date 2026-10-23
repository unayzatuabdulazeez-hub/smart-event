'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Business } from '@/lib/types';
import { Skeleton, ErrorBox } from './ui';

interface Ctx { business: Business; userId: string; userName: string; refresh: () => Promise<void> }
const BusinessContext = createContext<Ctx | null>(null);
export const useBusiness = () => {
  const c = useContext(BusinessContext);
  if (!c) throw new Error('useBusiness outside provider');
  return c;
};

export default function BusinessProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [state, setState] = useState<{ business: Business; userId: string; userName: string } | null>(null);
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
      setState({ business: biz as Business, userId: user.id, userName: (user.user_metadata?.full_name as string) || '' });
    } catch {
      setError('Unable to load your workspace. Your internet connection may be unstable.');
    }
  }, [router]);

  // Load once. After that, only reload when there is still no workspace (e.g. right after onboarding finishes).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!state) load(); }, [path]);

  if (path === '/app/onboarding') return <>{children}</>;
  if (error) return <div className="mx-auto max-w-md p-6"><ErrorBox message={error} onRetry={load} /></div>;
  if (!state) return <div className="mx-auto max-w-md space-y-4 p-6"><Skeleton className="h-10" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  return <BusinessContext.Provider value={{ ...state, refresh: load }}>{children}</BusinessContext.Provider>;
}

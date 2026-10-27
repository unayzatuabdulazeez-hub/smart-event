'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBusiness } from '@/components/BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { SERVICE_OPTIONS } from '@/lib/status';
import { Badge, Button, Card, ErrorBox, PageHeader, PoweredBy, cx, useToast } from '@/components/ui';

export default function Settings() {
  const { business, refresh, subscription } = useBusiness();
  const paidUntil = subscription?.paid_until ? new Date(subscription.paid_until).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const router = useRouter();
  const { toast, node } = useToast();
  const [services, setServices] = useState<string[]>(business.services ?? []);
  const [busy, setBusy] = useState<string | null>(null);
  const [demo, setDemo] = useState<{ url: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function saveServices() {
    setBusy('services');
    const { error } = await supabaseBrowser().from('businesses').update({ services }).eq('id', business.id);
    setBusy(null);
    if (error) toast.err(friendlyError(error, 'Unable to save.')); else { toast.ok('Services saved'); refresh(); }
  }
  async function loadDemo() {
    setBusy('demo'); setErr(null);
    const { data, error } = await supabaseBrowser().rpc('seed_demo_data');
    setBusy(null);
    if (error) { setErr(error.message.includes('DEMO_EXISTS') ? 'Demo data has already been added to this workspace.' : friendlyError(error, 'Unable to add demo data.')); return; }
    const origin = (process.env.NEXT_PUBLIC_APP_URL || location.origin).replace(/\/$/, '');
    setDemo({ url: `${origin}/portal/${(data as { portal_token: string }).portal_token}` }); toast.ok('Demo data added');
  }
  async function logout() {
    setBusy('logout');
    await supabaseBrowser().auth.signOut();
    router.replace('/login'); router.refresh();
  }
  return (
    <div className="space-y-5">{node}
      <PageHeader title="Settings" />
      <Card className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl">Your plan</h2><Badge tone="brand">Active</Badge></div>
        <p className="text-sm text-charcoal-300">{paidUntil ? `Your subscription is active until ${paidUntil}. Renew before then to keep full access.` : 'Your subscription is active.'}</p>
      </Card>
      <Card className="space-y-4">
        <h2 className="font-display text-xl">Services you offer</h2>
        <p className="text-sm text-charcoal-300">These appear first when you create a booking and on your public page.</p>
        <div className="flex flex-wrap gap-2">{SERVICE_OPTIONS.map((s) => { const on = services.includes(s); return <button key={s} type="button" aria-pressed={on} onClick={() => setServices(on ? services.filter((x) => x !== s) : [...services, s])} className={cx('min-h-[44px] rounded-full border px-4 text-sm font-semibold', on ? 'border-emerald bg-emerald-50 text-emerald-700' : 'border-charcoal-100 bg-white')}>{on ? '✓ ' : ''}{s}</button>; })}</div>
        <Button loading={busy === 'services'} loadingText="Saving..." onClick={saveServices}>Save services</Button>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-display text-xl">Try it with sample data</h2>
        <p className="text-sm text-charcoal-300">Adds four sample customers, bookings, payments, vendors and a customer portal so you can see how everything fits together. You can delete the sample records afterwards.</p>
        {demo && <div className="space-y-2 rounded-2xl border border-emerald/30 bg-emerald-50 p-4 text-sm"><p className="font-semibold text-emerald-700">Sample portal link. Copy it now: it cannot be shown again.</p><p className="break-all rounded-xl bg-white p-3 text-xs">{demo.url}</p><a href={demo.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-burgundy underline">Open the sample portal</a></div>}
        {err && <ErrorBox message={err} />}
        <Button variant="secondary" loading={busy === 'demo'} loadingText="Adding..." onClick={loadDemo}>Add sample data</Button>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-display text-xl">Account</h2>
        <Button variant="secondary" loading={busy === 'logout'} loadingText="Logging out..." onClick={logout}>Log out</Button>
      </Card>
      <PoweredBy />
    </div>
  );
}

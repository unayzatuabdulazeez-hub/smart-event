'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Badge, Button, Card, ErrorBox, inputCls, ListSkeleton, useToast } from '@/components/ui';

interface Row { email: string; business: string; access: string; paid_until: string | null; days_left: number; signed_up: string; note: string | null }
const dateOf = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
const tone = (a: string) => (a === 'active' ? 'good' : a === 'inactive' ? 'warn' : 'bad');

// Owner-only page. The real protection is in the database: every function below refuses anyone who is not in platform_admins.
export default function AdminPage() {
  const { toast, node } = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'denied' | 'login' | 'error'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setState('login'); return; }
    const { data, error } = await sb.rpc('admin_panel_list');
    if (error) {
      if (error.message.includes('NOT_ADMIN') || error.message.includes('permission denied')) { setState('denied'); return; }
      setErrMsg(error.message); setState('error'); return;
    }
    setRows(data as Row[]); setState('ok');
  }, []);
  useEffect(() => { load(); }, [load]);

  async function activate(email: string, days: number) {
    setBusy(email + 'a');
    const { data, error } = await supabaseBrowser().rpc('admin_panel_activate', { p_email: email, p_days: days });
    setBusy(null);
    if (error) { toast.err(error.message); return; }
    toast.ok(String(data)); load();
  }
  async function suspend(email: string) {
    if (!window.confirm(`Switch off ${email} now? They will see the payment screen.`)) return;
    setBusy(email + 's');
    const { error } = await supabaseBrowser().rpc('admin_panel_suspend', { p_email: email });
    setBusy(null);
    if (error) { toast.err(error.message); return; }
    toast.ok('Switched off'); load();
  }

  if (state === 'loading') return <main className="mx-auto max-w-2xl p-4"><ListSkeleton rows={4} /></main>;
  if (state === 'login') return <main className="mx-auto max-w-2xl p-4"><p className="text-sm">Please <a className="font-semibold text-burgundy underline" href="/login">log in</a> first.</p></main>;
  if (state === 'denied') return <main className="mx-auto max-w-2xl p-6"><h1 className="font-display text-2xl">Page not found</h1><p className="mt-2 text-sm text-charcoal-300">This page does not exist.</p></main>;
  if (state === 'error') return <main className="mx-auto max-w-2xl p-4"><ErrorBox message={`Could not load customers. ${errMsg}`} onRetry={load} /></main>;

  const list = (rows ?? []).filter((r) => `${r.email} ${r.business}`.toLowerCase().includes(q.trim().toLowerCase()));
  const count = (a: string) => (rows ?? []).filter((r) => r.access === a).length;
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 pb-16">
      {node}
      <h1 className="font-display text-3xl">Customers</h1>
      <p className="text-sm text-charcoal-300">{rows?.length ?? 0} total · {count('active')} active · {count('inactive')} waiting for payment · {count('expired')} expired · {count('suspended')} off</p>
      <input className={inputCls} placeholder="Search by email or business" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 && <Card><p className="text-sm">No customers found.</p></Card>}
      {list.map((r) => (
        <Card key={r.email} className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{r.business}</p>
              <p className="break-all text-sm text-charcoal-300">{r.email}</p>
            </div>
            <Badge tone={tone(r.access)}>{r.access}</Badge>
          </div>
          <p className="text-sm text-charcoal-300">Signed up {dateOf(r.signed_up)} · Paid until {dateOf(r.paid_until)}{r.access === 'active' ? ` (${r.days_left} days left)` : ''}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={busy === r.email + 'a'} loadingText="Saving..." onClick={() => activate(r.email, 30)}>{r.access === 'active' ? 'Add 30 days' : 'Activate 30 days'}</Button>
            {r.access !== 'suspended' && r.access !== 'inactive' && <Button size="sm" variant="secondary" loading={busy === r.email + 's'} onClick={() => suspend(r.email)}>Switch off</Button>}
          </div>
        </Card>
      ))}
    </main>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useBusiness } from '@/components/BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must, useQuery } from '@/lib/useQuery';
import { friendlyError } from '@/lib/errors';
import { formatShort, todayStr } from '@/lib/dates';
import { formatNaira } from '@/lib/money';
import { EXPENSE_CATEGORIES } from '@/lib/status';
import { Button, Card, EmptyState, ErrorBox, ListSkeleton, Modal, PageHeader, SelectField, TextField, useToast, ErrorBox as EB } from '@/components/ui';
import { toNum } from '@/components/ItemsEditor';

export default function Expenses() {
  const { business } = useBusiness();
  const { toast, node } = useToast();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (new URLSearchParams(window.location.search).get('new') === '1') setOpen(true); }, []);
  const [f, setF] = useState({ category: 'Ingredients', description: '', amount: '', date: todayStr(), eventId: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useQuery(async () => {
    const sb = supabaseBrowser();
    const [x, e] = await Promise.all([
      sb.from('event_expenses').select('id,category,description,amount,spent_on,events(name)').eq('business_id', business.id).order('spent_on', { ascending: false }).limit(200),
      sb.from('events').select('id,name').eq('business_id', business.id).order('event_date', { ascending: false }).limit(100),
    ]);
    return { expenses: must(x) as any[], events: must(e) as any[] };
  }, [business.id]);
  async function save() {
    const amount = toNum(f.amount);
    if (!(amount > 0)) { setErr('Enter an amount greater than zero.'); return; }
    setBusy(true); setErr(null);
    const { error } = await supabaseBrowser().from('event_expenses').insert({ business_id: business.id, event_id: f.eventId || null, category: f.category, description: f.description.trim() || null, amount, spent_on: f.date });
    setBusy(false);
    if (error) { setErr(friendlyError(error, 'Unable to save the expense.')); return; }
    setOpen(false); setF({ ...f, description: '', amount: '' }); toast.ok('Expense saved'); reload();
  }
  async function remove(id: string) {
    const { error } = await supabaseBrowser().from('event_expenses').delete().eq('id', id);
    if (error) toast.err(friendlyError(error, 'Unable to delete the expense.')); else reload();
  }
  const total = (data?.expenses ?? []).reduce((s, x) => s + Number(x.amount), 0);
  return (
    <div className="space-y-5">{node}
      <PageHeader title="Expenses" subtitle="Private. Never shown to customers." action={<Button size="sm" onClick={() => { setErr(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add</Button>} />
      {loading ? <ListSkeleton /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data || data.expenses.length === 0
        ? <EmptyState emoji="🧾" title="No expenses recorded yet" body="Record ingredients, transport, labour and more. Link them to an event to see your real profit." action={<Button onClick={() => setOpen(true)}>Add expense</Button>} />
        : <><Card><p className="text-xs font-semibold uppercase tracking-wide text-charcoal-300">Total recorded</p><p className="font-display text-3xl">{formatNaira(total)}</p></Card>
            <div className="divide-y divide-cream-200 rounded-2xl bg-white shadow-card">{data.expenses.map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-2 p-4 text-sm">
                <div><p className="font-semibold">{x.category}{x.description ? ` · ${x.description}` : ''}</p><p className="text-xs text-charcoal-300">{formatShort(x.spent_on)}{x.events?.name ? ` · ${x.events.name}` : ' · General'}</p></div>
                <div className="flex items-center"><span className="font-semibold">{formatNaira(x.amount)}</span><button aria-label="Delete expense" onClick={() => remove(x.id)} className="grid h-11 w-11 place-items-center text-charcoal-200 hover:text-coral-600"><Trash2 className="h-4 w-4" /></button></div>
              </div>))}</div></>}
      <Modal open={open} onClose={() => setOpen(false)} title="Add expense">
        <div className="space-y-4">
          <SelectField label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</SelectField>
          <TextField label="What was it for? (optional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <TextField label="Amount (₦)" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <TextField label="Date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          <SelectField label="Event (optional)" value={f.eventId} onChange={(e) => setF({ ...f, eventId: e.target.value })}><option value="">General business expense</option>{(data?.events ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</SelectField>
          {err && <EB message={err} />}
          <Button className="w-full" loading={busy} loadingText="Saving..." onClick={save}>Save expense</Button>
        </div>
      </Modal>
    </div>
  );
}

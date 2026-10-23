'use client';
import { useState } from 'react';
import { Lock, Plus, Trash2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { formatShort, todayStr } from '@/lib/dates';
import { formatNaira, profit } from '@/lib/money';
import { EXPENSE_CATEGORIES } from '@/lib/status';
import { Button, Card, ErrorBox, Modal, SectionTitle, SelectField, TextField } from '../ui';
import { toNum } from '../ItemsEditor';

export interface Expense { id: string; category: string; description: string | null; amount: number; spent_on: string }

export default function CostsPanel({ businessId, eventId, revenue, vendorCost, expenses, onChanged, toast }: {
  businessId: string; eventId: string; revenue: number; vendorCost: number; expenses: Expense[]; onChanged: () => void; toast: { err: (s: string) => void };
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ category: 'Ingredients', description: '', amount: '', date: todayStr() });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const expTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const p = profit(revenue, expTotal + vendorCost);

  async function save() {
    const amount = toNum(f.amount);
    if (!(amount > 0)) { setErr('Enter an amount greater than zero.'); return; }
    setBusy(true); setErr(null);
    const { error } = await supabaseBrowser().from('event_expenses').insert({ business_id: businessId, event_id: eventId, category: f.category, description: f.description.trim() || null, amount, spent_on: f.date });
    setBusy(false);
    if (error) { setErr(friendlyError(error, 'Unable to save the expense.')); return; }
    setOpen(false); setF({ category: 'Ingredients', description: '', amount: '', date: todayStr() }); onChanged();
  }
  async function remove(id: string) {
    const { error } = await supabaseBrowser().from('event_expenses').delete().eq('id', id);
    if (error) toast.err(friendlyError(error, 'Unable to delete the expense.')); else onChanged();
  }

  return (
    <section id="costs">
      <SectionTitle action={<Button size="sm" variant="secondary" onClick={() => { setErr(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add cost</Button>}>Costs &amp; profit</SectionTitle>
      <p className="mb-3 flex items-center gap-1.5 text-xs text-charcoal-300"><Lock className="h-3.5 w-3.5" /> Private. Never shown to customers.</p>
      <Card className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs font-semibold uppercase text-charcoal-300">Client revenue</dt><dd className="font-display text-xl">{formatNaira(p.revenue)}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-charcoal-300">Total internal cost</dt><dd className="font-display text-xl">{formatNaira(p.costs)}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-charcoal-300">Estimated profit</dt><dd className={`font-display text-xl ${p.profit < 0 ? 'text-coral-600' : 'text-emerald'}`}>{formatNaira(p.profit)}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-charcoal-300">Profit margin</dt><dd className={`font-display text-xl ${p.profit < 0 ? 'text-coral-600' : 'text-emerald'}`}>{p.margin}%</dd></div>
        </dl>
        {vendorCost > 0 && <p className="text-xs text-charcoal-300">Includes {formatNaira(vendorCost)} agreed with vendors (from the Vendors section above).</p>}
        <div className="divide-y divide-cream-200">
          {expenses.length === 0 ? <p className="py-2 text-sm text-charcoal-300">No costs recorded yet.</p> : expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 py-3 text-sm">
              <div><p className="font-semibold">{e.category}{e.description ? ` · ${e.description}` : ''}</p><p className="text-xs text-charcoal-300">{formatShort(e.spent_on)}</p></div>
              <div className="flex items-center gap-1"><span className="font-semibold">{formatNaira(e.amount)}</span>
                <button onClick={() => remove(e.id)} aria-label={`Delete ${e.category} cost`} className="grid h-11 w-11 place-items-center text-charcoal-200 hover:text-coral-600"><Trash2 className="h-4 w-4" /></button></div>
            </div>
          ))}
        </div>
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Add cost">
        <div className="space-y-4">
          <SelectField label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</SelectField>
          <TextField label="What was it for? (optional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <TextField label="Amount (₦)" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <TextField label="Date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          {err && <ErrorBox message={err} />}
          <Button className="w-full" loading={busy} loadingText="Saving..." onClick={save}>Save cost</Button>
        </div>
      </Modal>
    </section>
  );
}

'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { money } from '@/lib/validation';
import { todayStr } from '@/lib/dates';
import { EXPENSE_CATEGORIES } from '@/lib/status';
import { Button, ErrorBox, SelectField, TextField } from './ui';

export default function ExpenseForm({ businessId, eventId, events, onSaved, onCancel }: {
  businessId: string; eventId?: string | null; events?: { id: string; name: string }[]; onSaved: () => void; onCancel: () => void;
}) {
  const [f, setF] = useState({ category: 'Ingredients', description: '', amount: '', date: todayStr(), eventId: eventId ?? '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const a = money(f.amount);
    const er: Record<string, string> = {};
    if (!(a > 0)) er.amount = 'Enter an amount greater than zero.';
    if (!f.date) er.date = 'Choose a date.';
    setErr(er); if (Object.keys(er).length) return;
    setBusy(true); setError(null);
    const { error: x } = await supabaseBrowser().from('event_expenses').insert({
      business_id: businessId, event_id: f.eventId || null, category: f.category, description: f.description.trim() || null, amount: a, spent_on: f.date,
    });
    setBusy(false);
    if (x) setError(friendlyError(x, 'Unable to save expense.')); else onSaved();
  }
  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      {events && (
        <SelectField label="For which event?" value={f.eventId} onChange={(e) => setF({ ...f, eventId: e.target.value })} hint="Leave on 'General' for costs not tied to one event.">
          <option value="">General business expense</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </SelectField>
      )}
      <SelectField label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
        {EXPENSE_CATEGORIES.filter((c) => c !== 'Vendor').map((c) => <option key={c}>{c}</option>)}
      </SelectField>
      <TextField label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <TextField label="Amount (₦)" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} error={err.amount} />
      <TextField label="Date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} error={err.date} />
      {error && <ErrorBox message={error} />}
      <div className="flex gap-3"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit" className="flex-1" loading={busy} loadingText="Saving...">Save expense</Button></div>
    </form>
  );
}

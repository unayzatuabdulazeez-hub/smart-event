'use client';
import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { Button, Card, SectionTitle, cx, inputCls } from '../ui';

export interface CheckItem { id: string; label: string; done: boolean; sort: number }

export default function ChecklistPanel({ businessId, eventId, items, onChanged, toast }: {
  businessId: string; eventId: string; items: CheckItem[]; onChanged: () => void; toast: { err: (s: string) => void };
}) {
  const [label, setLabel] = useState('');
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const done = items.filter((i) => (local[i.id] ?? i.done)).length;

  async function toggle(i: CheckItem) {
    const v = !(local[i.id] ?? i.done);
    setLocal((p) => ({ ...p, [i.id]: v })); // optimistic
    const { error } = await supabaseBrowser().from('checklist_items').update({ done: v }).eq('id', i.id);
    if (error) { setLocal((p) => ({ ...p, [i.id]: !v })); toast.err(friendlyError(error, 'Unable to update the checklist.')); } else onChanged();
  }
  async function add() {
    if (!label.trim()) return;
    const { error } = await supabaseBrowser().from('checklist_items').insert({ business_id: businessId, event_id: eventId, label: label.trim(), sort: items.length + 1 });
    if (error) { toast.err(friendlyError(error, 'Unable to add that item.')); return; }
    setLabel(''); onChanged();
  }
  async function remove(i: CheckItem) {
    const { error } = await supabaseBrowser().from('checklist_items').delete().eq('id', i.id);
    if (error) toast.err(friendlyError(error, 'Unable to remove that item.')); else onChanged();
  }

  return (
    <section id="checklist">
      <SectionTitle action={<span className="text-sm font-semibold text-charcoal-300">{done}/{items.length} done</span>}>Event checklist</SectionTitle>
      <Card className="space-y-1">
        {items.map((i) => {
          const on = local[i.id] ?? i.done;
          return (
            <div key={i.id} className="flex items-center gap-1">
              <button onClick={() => toggle(i)} role="checkbox" aria-checked={on} className="flex min-h-[48px] flex-1 items-center gap-3 text-left">
                <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2', on ? 'border-emerald bg-emerald text-white' : 'border-charcoal-100 bg-white')}>{on && <Check className="h-4 w-4" />}</span>
                <span className={cx('text-sm', on && 'text-charcoal-300 line-through')}>{i.label}</span>
              </button>
              <button onClick={() => remove(i)} aria-label={`Remove ${i.label}`} className="min-h-[44px] px-2 text-xs font-semibold text-charcoal-200 hover:text-coral-600">Remove</button>
            </div>
          );
        })}
        <div className="flex gap-2 pt-3">
          <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="New checklist item" placeholder="Add your own item" className={inputCls} />
          <Button variant="secondary" onClick={add} aria-label="Add item"><Plus className="h-5 w-5" /></Button>
        </div>
      </Card>
    </section>
  );
}

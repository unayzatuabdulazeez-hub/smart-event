'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { formatShort, todayStr } from '@/lib/dates';
import type { Task } from '@/lib/types';
import { Badge, Button, ErrorBox, Modal, SelectField, TextArea, TextField } from './ui';

const STATUS = [['todo', 'To Do'], ['in_progress', 'In Progress'], ['done', 'Done']] as const;
const PRIORITY = [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']] as const;

export function TaskRows({ tasks, onChanged, toast, showEvent }: {
  tasks: (Task & { events?: { name: string } | null })[]; onChanged: () => void; toast: { err: (s: string) => void }; showEvent?: boolean;
}) {
  const today = todayStr();
  async function setStatus(t: Task, status: string) {
    const { error } = await supabaseBrowser().from('tasks').update({ status }).eq('id', t.id);
    if (error) toast.err(friendlyError(error, 'Unable to update the task.')); else onChanged();
  }
  async function remove(t: Task) {
    const { error } = await supabaseBrowser().from('tasks').delete().eq('id', t.id);
    if (error) toast.err(friendlyError(error, 'Unable to delete the task.')); else onChanged();
  }
  return (
    <div className="divide-y divide-cream-200">
      {tasks.map((t) => (
        <div key={t.id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className={t.status === 'done' ? 'text-sm text-charcoal-300 line-through' : 'text-sm font-semibold'}>{t.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {t.due_date && <Badge tone={t.status !== 'done' && t.due_date < today ? 'bad' : 'neutral'}>{t.status !== 'done' && t.due_date < today ? 'Overdue · ' : ''}{formatShort(t.due_date)}</Badge>}
              {t.priority === 'high' && <Badge tone="warn">High priority</Badge>}
              {showEvent && t.events?.name && <span className="text-xs text-charcoal-300">{t.events.name}</span>}
            </div>
          </div>
          <select aria-label={`Status of ${t.title}`} value={t.status} onChange={(e) => setStatus(t, e.target.value)} className="min-h-[44px] rounded-xl border border-charcoal-100 bg-white px-2 text-sm">
            {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button aria-label={`Delete ${t.title}`} onClick={() => remove(t)} className="grid h-11 w-11 place-items-center rounded-xl text-charcoal-200 hover:text-coral-600"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}

export function AddTaskButton({ businessId, eventId, onSaved }: { businessId: string; eventId?: string | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', due: '', priority: 'normal', notes: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!f.title.trim()) { setErr('Give the task a title.'); return; }
    setBusy(true); setErr(null);
    const { error } = await supabaseBrowser().from('tasks').insert({
      business_id: businessId, event_id: eventId ?? null, title: f.title.trim(), due_date: f.due || null, priority: f.priority, notes: f.notes.trim() || null,
    });
    setBusy(false);
    if (error) { setErr(friendlyError(error, 'Unable to save the task.')); return; }
    setOpen(false); setF({ title: '', due: '', priority: 'normal', notes: '' }); onSaved();
  }
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add task</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New task">
        <div className="space-y-4">
          <TextField label="What needs doing?" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <TextField label="Due date" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
          <SelectField label="Priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{PRIORITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</SelectField>
          <TextArea label="Notes (optional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          {err && <ErrorBox message={err} />}
          <Button className="w-full" loading={busy} loadingText="Saving..." onClick={save}>Save task</Button>
        </div>
      </Modal>
    </>
  );
}

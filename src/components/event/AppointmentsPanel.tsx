'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { useQuery } from '@/lib/useQuery';
import type { PanelProps } from './types';
import { Badge, Button, Card, ErrorBox, Modal, SectionTitle, TextArea, TextField, Toggle } from '../ui';

interface Appt { id: string; title: string; starts_at: string; location: string | null; customer_visible: boolean }

export default function AppointmentsPanel({ event, business, toast }: PanelProps) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', when: '', location: '', notes: '', visible: false });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const { data, error, reload } = useQuery(async () => {
    const { data, error: e } = await supabaseBrowser().from('appointments').select('id,title,starts_at,location,customer_visible').eq('event_id', event.id).order('starts_at');
    if (e) throw e;
    return (data ?? []) as Appt[];
  }, [event.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.title.trim()) er.title = 'What is the appointment for?';
    if (!f.when) er.when = 'Choose a date and time.';
    setErr(er); if (Object.keys(er).length) return;
    setBusy(true);
    const { error: x } = await supabaseBrowser().from('appointments').insert({
      business_id: business.id, event_id: event.id, title: f.title.trim(), starts_at: new Date(f.when).toISOString(),
      location: f.location.trim() || null, notes: f.notes.trim() || null, customer_visible: f.visible,
    });
    setBusy(false);
    if (x) { toast.err(friendlyError(x, 'Unable to save appointment.')); return; }
    setOpen(false); setF({ title: '', when: '', location: '', notes: '', visible: false }); reload();
  }
  async function remove(a: Appt) {
    const { error: e } = await supabaseBrowser().from('appointments').delete().eq('id', a.id);
    if (e) toast.err(friendlyError(e)); else reload();
  }

  return (
    <section aria-labelledby="appt-h">
      <SectionTitle action={<Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden /> Add</Button>}><span id="appt-h">Appointments</span></SectionTitle>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.length === 0 && <p className="rounded-xl bg-cream-50 p-4 text-sm text-charcoal-300">No appointments yet, such as a tasting or venue visit.</p>}
      <ul className="space-y-2">
        {(data ?? []).map((a) => (
          <li key={a.id}><Card className="flex items-center justify-between gap-2 !p-3">
            <div className="min-w-0"><p className="font-semibold">{a.title}</p>
              <p className="text-sm text-charcoal-300">{new Date(a.starts_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{a.location ? ` · ${a.location}` : ''}</p></div>
            <div className="flex items-center gap-1">{a.customer_visible && <Badge tone="good">Shown to customer</Badge>}
              <button onClick={() => remove(a)} aria-label={`Delete ${a.title}`} className="grid h-11 w-11 place-items-center rounded-lg text-charcoal-200 hover:bg-coral-50 hover:text-coral-600"><Trash2 className="h-4 w-4" aria-hidden /></button></div>
          </Card></li>
        ))}
      </ul>
      <Modal open={open} onClose={() => setOpen(false)} title="Add appointment">
        <form onSubmit={save} className="space-y-4" noValidate>
          <TextField label="What for?" placeholder="Final tasting" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} error={err.title} />
          <TextField label="Date and time" type="datetime-local" value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} error={err.when} />
          <TextField label="Location" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
          <TextArea label="Private notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <Toggle label="Show on customer's portal" checked={f.visible} onChange={(v) => setF({ ...f, visible: v })} />
          <div className="flex gap-3"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={busy} loadingText="Saving...">Save</Button></div>
        </form>
      </Modal>
    </section>
  );
}

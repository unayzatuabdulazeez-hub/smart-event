'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { useBusiness } from '@/components/BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must, useQuery } from '@/lib/useQuery';
import { friendlyError } from '@/lib/errors';
import { grandTotal } from '@/lib/money';
import { EVENT_TYPES, SERVICE_OPTIONS } from '@/lib/status';
import { Button, Card, EmptyState, ErrorBox, ListSkeleton, Modal, PageHeader, SelectField, TextField, cx, useToast } from '@/components/ui';
import ItemsEditor, { emptyItem, itemErrors, itemsToNumbers, toNum, type ItemDraft } from '@/components/ItemsEditor';

export default function Templates() {
  const { business } = useBusiness();
  const { toast, node } = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', type: 'Wedding', guests: '' });
  const [services, setServices] = useState<string[]>([]);
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useQuery(async () => must(await supabaseBrowser().from('event_templates').select('*').eq('business_id', business.id).order('name')) as any[], [business.id]);

  async function save() {
    if (!f.name.trim()) return setErr('Give the package a name.');
    const ie = itemErrors(items); if (ie) return setErr(ie);
    if (f.guests !== '' && (!Number.isInteger(Number(f.guests)) || Number(f.guests) < 0)) return setErr('Guest count must be a whole number.');
    setBusy(true); setErr(null);
    const { error } = await supabaseBrowser().from('event_templates').insert({
      business_id: business.id, name: f.name.trim(), event_type: f.type, guest_count: Number(f.guests || 0), services,
      items: items.filter((i) => i.service.trim()).map((i) => ({ service: i.service.trim(), description: i.description.trim() || null, quantity: toNum(i.quantity), unit_price: toNum(i.unit_price) })),
    });
    setBusy(false);
    if (error) return setErr(friendlyError(error, 'Unable to save the package.'));
    setOpen(false); setF({ name: '', type: 'Wedding', guests: '' }); setServices([]); setItems([emptyItem()]); toast.ok('Package saved'); reload();
  }
  async function remove(id: string) {
    const { error } = await supabaseBrowser().from('event_templates').delete().eq('id', id);
    if (error) toast.err(friendlyError(error, 'Unable to delete the package.')); else reload();
  }
  return (
    <div className="space-y-5">{node}
      <PageHeader title="Packages" subtitle="Save what you sell often and book it in seconds" action={<Button size="sm" onClick={() => { setErr(null); setOpen(true); }}><Plus className="h-4 w-4" /> New</Button>} />
      {loading ? <ListSkeleton /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data || data.length === 0
        ? <EmptyState emoji="📦" title="No saved packages yet" body="Create one here, or save any booking as a package from its page." action={<Button onClick={() => setOpen(true)}>Create package</Button>} />
        : <div className="space-y-3">{data.map((t) => {
            const total = grandTotal(itemsToNumbers((t.items ?? []).map((i: any) => ({ service: i.service, description: '', quantity: String(i.quantity), unit_price: String(i.unit_price) }))));
            return (
              <Card key={t.id} className="space-y-2">
                <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{t.name}</p><p className="text-sm text-charcoal-300">{t.event_type}{t.guest_count ? ` · ${t.guest_count} guests` : ''} · ₦{total.toLocaleString('en-NG')}</p></div>
                  <button aria-label={`Delete ${t.name}`} onClick={() => remove(t.id)} className="grid h-11 w-11 place-items-center text-charcoal-200 hover:text-coral-600"><Trash2 className="h-4 w-4" /></button></div>
                <Link href={`/app/events/new?template=${t.id}`} className="contents"><Button size="sm">Use for a new booking</Button></Link>
              </Card>);
          })}</div>}
      <Modal open={open} onClose={() => setOpen(false)} title="New package">
        <div className="space-y-4">
          <TextField label="Package name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Premium Wedding Catering, 350 guests" />
          <SelectField label="Event type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</SelectField>
          <TextField label="Guests" inputMode="numeric" value={f.guests} onChange={(e) => setF({ ...f, guests: e.target.value })} />
          <div className="flex flex-wrap gap-2">{SERVICE_OPTIONS.map((s) => { const on = services.includes(s); return <button key={s} type="button" aria-pressed={on} onClick={() => setServices(on ? services.filter((x) => x !== s) : [...services, s])} className={cx('min-h-[44px] rounded-full border px-4 text-sm font-semibold', on ? 'border-emerald bg-emerald-50 text-emerald-700' : 'border-charcoal-100 bg-white')}>{on ? '✓ ' : ''}{s}</button>; })}</div>
          <ItemsEditor items={items} onChange={setItems} />
          {err && <ErrorBox message={err} />}
          <Button className="w-full" loading={busy} loadingText="Saving..." onClick={save}>Save package</Button>
        </div>
      </Modal>
    </div>
  );
}

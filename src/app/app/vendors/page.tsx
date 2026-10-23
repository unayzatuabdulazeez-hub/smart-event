'use client';
import { useState } from 'react';
import { MessageCircle, Plus } from 'lucide-react';
import { useBusiness } from '@/components/BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must, useQuery } from '@/lib/useQuery';
import { friendlyError } from '@/lib/errors';
import { optionalEmailError, optionalPhoneError } from '@/lib/validation';
import { whatsappLink } from '@/lib/whatsapp';
import { VENDOR_TYPES } from '@/lib/status';
import { Button, Card, EmptyState, ErrorBox, ListSkeleton, Modal, PageHeader, SelectField, TextArea, TextField, useToast } from '@/components/ui';

interface V { id: string; name: string; service: string; phone: string | null; whatsapp: string | null; email: string | null; notes: string | null }
const blank = { name: '', service: 'Decorator', phone: '', whatsapp: '', email: '', notes: '' };

export default function Vendors() {
  const { business } = useBusiness();
  const { toast, node } = useToast();
  const [edit, setEdit] = useState<V | 'new' | null>(null);
  const [f, setF] = useState(blank);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useQuery(async () => must(await supabaseBrowser().from('vendors').select('*').eq('business_id', business.id).order('name')) as V[], [business.id]);

  function open(v: V | 'new') { setEdit(v); setErrs({}); setF(v === 'new' ? blank : { name: v.name, service: v.service, phone: v.phone ?? '', whatsapp: v.whatsapp ?? '', email: v.email ?? '', notes: v.notes ?? '' }); }
  async function save() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Enter the vendor’s name.';
    const p = optionalPhoneError(f.phone); if (p) e.phone = p;
    const w = optionalPhoneError(f.whatsapp); if (w) e.whatsapp = w;
    const m = optionalEmailError(f.email); if (m) e.email = m;
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true);
    const payload = { name: f.name.trim(), service: f.service, phone: f.phone.trim() || null, whatsapp: (f.whatsapp || f.phone).trim() || null, email: f.email.trim() || null, notes: f.notes.trim() || null };
    const sb = supabaseBrowser();
    const res = edit === 'new' ? await sb.from('vendors').insert({ ...payload, business_id: business.id }) : await sb.from('vendors').update(payload).eq('id', (edit as V).id);
    setBusy(false);
    if (res.error) { toast.err(friendlyError(res.error, 'Unable to save the vendor.')); return; }
    setEdit(null); toast.ok('Vendor saved'); reload();
  }
  async function remove(v: V) {
    const { error } = await supabaseBrowser().from('vendors').delete().eq('id', v.id);
    if (error) toast.err(friendlyError(error, 'Unable to delete this vendor.')); else { setEdit(null); reload(); }
  }
  return (
    <div className="space-y-5">{node}
      <PageHeader title="Vendors" subtitle="Private. Customers never see this list." action={<Button size="sm" onClick={() => open('new')}><Plus className="h-4 w-4" /> Add</Button>} />
      {loading ? <ListSkeleton /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data || data.length === 0
        ? <EmptyState emoji="🧑🏽‍🍳" title="No vendors yet" body="Add the decorators, photographers, DJs and others you work with. You can attach them to any booking." action={<Button onClick={() => open('new')}>Add vendor</Button>} />
        : <div className="space-y-3">{data.map((v) => {
            const wa = whatsappLink(v.whatsapp || v.phone, `Hello ${v.name}, this is ${business.name}.`);
            return (
              <Card key={v.id} className="flex items-center justify-between gap-3">
                <button onClick={() => open(v)} className="min-w-0 text-left"><p className="truncate font-semibold">{v.name}</p><p className="truncate text-sm text-charcoal-300">{v.service}{v.phone ? ` · ${v.phone}` : ''}</p></button>
                {wa && <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${v.name}`} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald text-white"><MessageCircle className="h-5 w-5" /></a>}
              </Card>);
          })}</div>}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Add vendor' : 'Edit vendor'}>
        <div className="space-y-4">
          <TextField label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errs.name} />
          <SelectField label="Service" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}>{VENDOR_TYPES.map((t) => <option key={t}>{t}</option>)}</SelectField>
          <TextField label="Phone" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} error={errs.phone} />
          <TextField label="WhatsApp" inputMode="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} error={errs.whatsapp} />
          <TextField label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errs.email} />
          <TextArea label="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <div className="flex gap-3">{edit !== 'new' && edit && <Button variant="ghost" onClick={() => remove(edit as V)}>Delete</Button>}<Button className="flex-1" loading={busy} loadingText="Saving..." onClick={save}>Save vendor</Button></div>
        </div>
      </Modal>
    </div>
  );
}

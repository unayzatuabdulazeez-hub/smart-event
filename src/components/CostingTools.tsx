'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useBusiness } from './BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must } from '@/lib/useQuery';
import { friendlyError } from '@/lib/errors';
import { cateringResult, chopsResult } from '@/lib/costing';
import { formatNaira } from '@/lib/money';
import { formatShort } from '@/lib/dates';
import { Button, Card, ErrorBox, SectionTitle, SelectField, TextField, cx, inputCls, useToast } from './ui';
import { toNum } from './ItemsEditor';

const n = (s: string) => toNum(s);
const PACKAGES: Record<string, { name: string; per: string }[]> = {
  Basic: [{ name: 'Spring rolls', per: '2' }, { name: 'Puff-puff', per: '3' }, { name: 'Samosa', per: '2' }],
  Standard: [{ name: 'Spring rolls', per: '2' }, { name: 'Samosa', per: '2' }, { name: 'Puff-puff', per: '3' }, { name: 'Chicken', per: '1' }],
  Premium: [{ name: 'Spring rolls', per: '2' }, { name: 'Samosa', per: '2' }, { name: 'Puff-puff', per: '3' }, { name: 'Chicken', per: '2' }, { name: 'Doughnut', per: '1' }, { name: 'Fish rolls', per: '1' }],
};

function Result({ rows, big }: { rows: [string, string][]; big?: [string, string] }) {
  return (
    <Card className="space-y-2 border-emerald/30 bg-emerald-50" aria-live="polite">
      {rows.map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span>{k}</span><span className="font-semibold">{v}</span></div>)}
      {big && <div className="flex justify-between border-t border-emerald/30 pt-2 font-display text-2xl"><span>{big[0]}</span><span>{big[1]}</span></div>}
    </Card>
  );
}

function SaveBar({ kind, name, setName, eventId, setEventId, events, onSave, busy }: { kind: string; name: string; setName: (s: string) => void; eventId: string; setEventId: (s: string) => void; events: any[]; onSave: () => void; busy: boolean }) {
  return (
    <Card className="space-y-3">
      <h3 className="font-display text-lg">Save this costing</h3>
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${kind} for Maryam’s wedding`} />
      <SelectField label="Attach to a booking (optional)" value={eventId} onChange={(e) => setEventId(e.target.value)}><option value="">Not attached</option>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</SelectField>
      <Button className="w-full" loading={busy} loadingText="Saving..." onClick={onSave}>Save costing</Button>
    </Card>
  );
}

function useEvents(businessId: string) {
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => { supabaseBrowser().from('events').select('id,name').eq('business_id', businessId).order('event_date', { ascending: false }).limit(100).then((r) => setEvents(r.data ?? [])); }, [businessId]);
  return events;
}

function Saved({ table, reload, rows }: { table: 'catering_costings' | 'small_chops_costings'; rows: any[]; reload: () => void }) {
  const { toast, node } = useToast();
  async function remove(id: string) {
    const { error } = await supabaseBrowser().from(table).delete().eq('id', id);
    if (error) toast.err(friendlyError(error, 'Unable to delete.')); else reload();
  }
  if (!rows.length) return null;
  return (
    <section>{node}<SectionTitle>Saved costings</SectionTitle>
      <div className="divide-y divide-cream-200 rounded-2xl bg-white shadow-card">{rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2 p-4 text-sm">
          <div><p className="font-semibold">{r.name}</p><p className="text-xs text-charcoal-300">{r.guests} guests · cost {formatNaira(r.total_cost)} · price {formatNaira(r.selling_price)} · {formatShort(r.created_at.slice(0, 10))}</p></div>
          <button aria-label={`Delete ${r.name}`} onClick={() => remove(r.id)} className="grid h-11 w-11 place-items-center text-charcoal-200 hover:text-coral-600"><Trash2 className="h-4 w-4" /></button>
        </div>))}</div></section>
  );
}

function Catering() {
  const { business } = useBusiness();
  const { toast, node } = useToast();
  const events = useEvents(business.id);
  const [guests, setGuests] = useState('100');
  const [ing, setIng] = useState([{ name: '', quantity: '', unit_cost: '' }]);
  const [x, setX] = useState({ labour: '', gas: '', packaging: '', transport: '', other: '', price: '' });
  const [name, setName] = useState(''); const [eventId, setEventId] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<any[]>([]);
  const load = async () => { try { setSaved(must(await supabaseBrowser().from('catering_costings').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(20)) as any[]); } catch { /* list is optional */ } };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [business.id]);

  const input = { guests: n(guests), ingredients: ing.map((i) => ({ name: i.name, quantity: n(i.quantity), unit_cost: n(i.unit_cost) })), labour: n(x.labour), gas: n(x.gas), packaging: n(x.packaging), transport: n(x.transport), other: n(x.other), selling_price: n(x.price) };
  const r = cateringResult(input);
  const suggested = Math.round(r.totalCost * 1.3);

  async function save() {
    if (!name.trim()) return setErr('Give this costing a name.');
    if (!(input.guests > 0)) return setErr('Enter the number of guests.');
    setBusy(true); setErr(null);
    const { error } = await supabaseBrowser().from('catering_costings').insert({ business_id: business.id, event_id: eventId || null, name: name.trim(), guests: input.guests, data: { ...input, ingredients: ing }, total_cost: r.totalCost, selling_price: r.sellingPrice });
    setBusy(false);
    if (error) return setErr(friendlyError(error, 'Unable to save the costing.'));
    toast.ok('Costing saved'); setName(''); load();
  }
  return (
    <div className="space-y-5">{node}
      <Card className="space-y-4">
        <TextField label="Number of guests" inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value)} />
        <h3 className="font-display text-lg">Ingredients &amp; menu items</h3>
        {ing.map((i, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl border border-charcoal-100 p-3">
            <input aria-label={`Ingredient ${idx + 1}`} placeholder="e.g. Rice (bag)" value={i.name} onChange={(e) => setIng(ing.map((v, k) => (k === idx ? { ...v, name: e.target.value } : v)))} className={inputCls} />
            <button aria-label={`Remove ingredient ${idx + 1}`} onClick={() => setIng(ing.length > 1 ? ing.filter((_, k) => k !== idx) : [{ name: '', quantity: '', unit_cost: '' }])} className="grid h-12 w-12 place-items-center text-coral-600"><Trash2 className="h-5 w-5" /></button>
            <div className="col-span-2 grid grid-cols-2 gap-2">
              <input aria-label="Quantity" inputMode="decimal" placeholder="Quantity" value={i.quantity} onChange={(e) => setIng(ing.map((v, k) => (k === idx ? { ...v, quantity: e.target.value } : v)))} className={inputCls} />
              <input aria-label="Cost per unit" inputMode="decimal" placeholder="Cost per unit ₦" value={i.unit_cost} onChange={(e) => setIng(ing.map((v, k) => (k === idx ? { ...v, unit_cost: e.target.value } : v)))} className={inputCls} />
            </div>
          </div>))}
        <Button variant="secondary" size="sm" onClick={() => setIng([...ing, { name: '', quantity: '', unit_cost: '' }])}><Plus className="h-4 w-4" /> Add ingredient</Button>
        <div className="grid grid-cols-2 gap-3">
          {([['labour', 'Labour'], ['gas', 'Gas / Fuel'], ['packaging', 'Packaging'], ['transport', 'Transport'], ['other', 'Other expenses']] as const).map(([k, l]) => <TextField key={k} label={`${l} (₦)`} inputMode="decimal" value={x[k]} onChange={(e) => setX({ ...x, [k]: e.target.value })} />)}
        </div>
        <TextField label="Selling price (₦)" inputMode="decimal" value={x.price} onChange={(e) => setX({ ...x, price: e.target.value })} hint={r.totalCost > 0 ? `A 30% markup would be ${formatNaira(suggested)}. Tap to use it.` : undefined} />
        {r.totalCost > 0 && <Button size="sm" variant="ghost" onClick={() => setX({ ...x, price: String(suggested) })}>Use {formatNaira(suggested)}</Button>}
      </Card>
      <Result rows={[['Ingredient cost', formatNaira(r.ingredientCost)], ['Total cost', formatNaira(r.totalCost)], ['Cost per guest', formatNaira(r.costPerGuest)], ['Selling price', formatNaira(r.sellingPrice)], ['Profit per guest', formatNaira(r.profitPerGuest)], ['Profit margin', `${r.margin}%`]]} big={['Profit', formatNaira(r.profit)]} />
      {err && <ErrorBox message={err} />}
      <SaveBar kind="Catering" name={name} setName={setName} eventId={eventId} setEventId={setEventId} events={events} onSave={save} busy={busy} />
      <Saved table="catering_costings" rows={saved} reload={load} />
    </div>
  );
}

function SmallChops() {
  const { business } = useBusiness();
  const { toast, node } = useToast();
  const events = useEvents(business.id);
  const [guests, setGuests] = useState('100');
  const [pkg, setPkg] = useState('Standard');
  const [items, setItems] = useState(PACKAGES.Standard.map((p) => ({ name: p.name, per: p.per, unit: '', override: '' })));
  const [x, setX] = useState({ packaging: '', labour: '', transport: '', other: '', markup: '40', waste: '5' });
  const [name, setName] = useState(''); const [eventId, setEventId] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<any[]>([]);
  const load = async () => { try { setSaved(must(await supabaseBrowser().from('small_chops_costings').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(20)) as any[]); } catch { /* optional */ } };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [business.id]);

  const input = { guests: n(guests), items: items.map((i) => ({ name: i.name, per_guest: n(i.per), unit_cost: n(i.unit), override_qty: i.override === '' ? null : n(i.override) })), packaging: n(x.packaging), labour: n(x.labour), transport: n(x.transport), other: n(x.other), markup_percent: n(x.markup), wastage_percent: n(x.waste) };
  const r = chopsResult(input);
  const upd = (idx: number, patch: Partial<(typeof items)[number]>) => setItems(items.map((v, k) => (k === idx ? { ...v, ...patch } : v)));

  async function save() {
    if (!name.trim()) return setErr('Give this costing a name.');
    if (!(input.guests > 0)) return setErr('Enter the number of guests.');
    setBusy(true); setErr(null);
    const { error } = await supabaseBrowser().from('small_chops_costings').insert({ business_id: business.id, event_id: eventId || null, name: name.trim(), guests: input.guests, data: { ...input, package: pkg, rows: items }, total_cost: r.totalCost, selling_price: r.suggestedPrice });
    setBusy(false);
    if (error) return setErr(friendlyError(error, 'Unable to save the costing.'));
    toast.ok('Costing saved'); setName(''); load();
  }
  return (
    <div className="space-y-5">{node}
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Number of guests" inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value)} />
          <SelectField label="Package type" value={pkg} onChange={(e) => { setPkg(e.target.value); if (PACKAGES[e.target.value]) setItems(PACKAGES[e.target.value].map((p) => ({ name: p.name, per: p.per, unit: '', override: '' }))); }}>
            {Object.keys(PACKAGES).map((k) => <option key={k}>{k}</option>)}<option>Custom</option></SelectField>
        </div>
        <h3 className="font-display text-lg">Items</h3>
        {items.map((i, idx) => {
          const line = r.lines[idx];
          return (
            <div key={idx} className="space-y-2 rounded-2xl border border-charcoal-100 p-3">
              <div className="flex gap-2"><input aria-label={`Item ${idx + 1}`} value={i.name} onChange={(e) => upd(idx, { name: e.target.value })} placeholder="Item e.g. Spring rolls" className={inputCls} />
                <button aria-label={`Remove ${i.name || 'item'}`} onClick={() => setItems(items.filter((_, k) => k !== idx))} className="grid h-12 w-12 shrink-0 place-items-center text-coral-600"><Trash2 className="h-5 w-5" /></button></div>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs font-semibold text-charcoal-300">Per guest<input inputMode="decimal" value={i.per} onChange={(e) => upd(idx, { per: e.target.value })} className={inputCls + ' mt-1'} /></label>
                <label className="text-xs font-semibold text-charcoal-300">Cost each (₦)<input inputMode="decimal" value={i.unit} onChange={(e) => upd(idx, { unit: e.target.value })} className={inputCls + ' mt-1'} /></label>
                <label className="text-xs font-semibold text-charcoal-300">Make (override)<input inputMode="numeric" value={i.override} placeholder={String(line?.quantity ?? 0)} onChange={(e) => upd(idx, { override: e.target.value })} className={inputCls + ' mt-1'} /></label>
              </div>
              <p className="text-right text-sm font-semibold">{line?.quantity ?? 0} pieces · {formatNaira(line?.cost ?? 0)}</p>
            </div>);
        })}
        <Button variant="secondary" size="sm" onClick={() => { setPkg('Custom'); setItems([...items, { name: '', per: '1', unit: '', override: '' }]); }}><Plus className="h-4 w-4" /> Add item</Button>
        <div className="grid grid-cols-2 gap-3">
          {([['packaging', 'Packaging'], ['labour', 'Labour'], ['transport', 'Transport'], ['other', 'Other expenses']] as const).map(([k, l]) => <TextField key={k} label={`${l} (₦)`} inputMode="decimal" value={x[k]} onChange={(e) => setX({ ...x, [k]: e.target.value })} />)}
          <TextField label="Extra for wastage (%)" inputMode="decimal" value={x.waste} onChange={(e) => setX({ ...x, waste: e.target.value })} hint="Makes a little extra to cover spoilage." />
          <TextField label="Markup (%)" inputMode="decimal" value={x.markup} onChange={(e) => setX({ ...x, markup: e.target.value })} />
        </div>
      </Card>
      <Result rows={[['Pieces to produce', String(r.lines.reduce((s, l) => s + l.quantity, 0))], ['Total cost', formatNaira(r.totalCost)], ['Cost per guest', formatNaira(r.costPerGuest)], ['Suggested selling price', formatNaira(r.suggestedPrice)], ['Profit per guest', formatNaira(r.profitPerGuest)], ['Profit margin', `${r.margin}%`]]} big={['Estimated profit', formatNaira(r.profit)]} />
      {err && <ErrorBox message={err} />}
      <SaveBar kind="Small chops" name={name} setName={setName} eventId={eventId} setEventId={setEventId} events={events} onSave={save} busy={busy} />
      <Saved table="small_chops_costings" rows={saved} reload={load} />
    </div>
  );
}

export default function CostingTools() {
  const [tab, setTab] = useState<'catering' | 'chops'>('catering');
  return (
    <div className="space-y-5">
      <div className="flex gap-2" role="tablist" aria-label="Costing tool">
        {([['catering', 'Catering'], ['chops', 'Small Chops']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('min-h-[48px] flex-1 rounded-full border text-sm font-semibold', tab === k ? 'border-burgundy bg-burgundy text-white' : 'border-charcoal-100 bg-white')}>{l}</button>))}
      </div>
      {tab === 'catering' ? <Catering /> : <SmallChops />}
    </div>
  );
}

'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';
import { useBusiness } from '@/components/BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must } from '@/lib/useQuery';
import { friendlyError } from '@/lib/errors';
import { grandTotal, validatePayment } from '@/lib/money';
import { EVENT_TYPES, SERVICE_OPTIONS } from '@/lib/status';
import { todayStr } from '@/lib/dates';
import type { Customer } from '@/lib/types';
import { Button, Card, ErrorBox, PageHeader, SelectField, TextArea, TextField, Modal, cx } from '@/components/ui';
import CustomerForm from '@/components/CustomerForm';
import ItemsEditor, { emptyItem, itemErrors, itemsToNumbers, toNum, type ItemDraft } from '@/components/ItemsEditor';
import AdjustmentsEditor, { adjError, adjNumbers, emptyAdj } from '@/components/AdjustmentsEditor';

const STEPS = ['Customer', 'Event', 'Details', 'Services', 'Deposit', 'Review'];

function Wizard() {
  const { business } = useBusiness();
  const router = useRouter();
  const params = useSearchParams();
  const sb = supabaseBrowser();
  const [step, setStep] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custQ, setCustQ] = useState('');
  const [customerId, setCustomerId] = useState<string>(params.get('customer') ?? '');
  const [newCust, setNewCust] = useState(false);
  const [type, setType] = useState('Wedding');
  const [customType, setCustomType] = useState('');
  const [d, setD] = useState({ name: '', date: '', start: '', end: '', venue: '', venueAddress: '', guests: '', description: '', instructions: '' });
  const [services, setServices] = useState<string[]>([]);
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [adj, setAdj] = useState(emptyAdj());
  const [dep, setDep] = useState({ required: '', paid: '', method: 'bank_transfer', date: todayStr(), reference: '', dueDate: '' });
  const [templates, setTemplates] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, t] = await Promise.all([
          sb.from('customers').select('*').eq('business_id', business.id).order('name').limit(500),
          sb.from('event_templates').select('*').eq('business_id', business.id).order('name'),
        ]);
        setCustomers(must(c) as Customer[]); setTemplates(must(t) as any[]);
        const tid = params.get('template');
        if (tid) { const tpl = (must(t) as any[]).find((x) => x.id === tid); if (tpl) applyTemplate(tpl); }
      } catch (e) { setErr(friendlyError(e, 'Unable to load your customers.')); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id]);

  function applyTemplate(tpl: any) {
    setType(EVENT_TYPES.includes(tpl.event_type) ? tpl.event_type : 'Other');
    if (!EVENT_TYPES.includes(tpl.event_type)) setCustomType(tpl.event_type);
    setServices(tpl.services ?? []);
    setD((p) => ({ ...p, guests: String(tpl.guest_count || '') }));
    const its = (tpl.items ?? []).map((i: any) => ({ service: i.service, description: i.description ?? '', quantity: String(i.quantity), unit_price: String(i.unit_price) }));
    if (its.length) setItems(its);
  }

  const customer = customers.find((c) => c.id === customerId);
  const eventType = type === 'Other' && customType.trim() ? customType.trim() : type;
  const nums = itemsToNumbers(items);
  const total = useMemo(() => grandTotal(nums, adjNumbers(adj)), [nums, adj]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = customers.filter((c) => !custQ.trim() || c.name.toLowerCase().includes(custQ.toLowerCase()) || (c.phone ?? '').includes(custQ) || (c.whatsapp ?? '').includes(custQ));

  function validate(s: number): string | null {
    if (s === 0 && !customerId) return 'Choose a customer, or add a new one.';
    if (s === 1 && type === 'Other' && !customType.trim()) return 'Type a name for this kind of event.';
    if (s === 2) {
      if (!d.name.trim()) return 'Give the event a name, e.g. “Maryam & Ahmed Wedding”.';
      if (!d.date) return 'Choose the event date.';
      if (d.start && d.end && d.end < d.start) return 'The end time must be after the start time.';
      if (d.guests !== '' && (!Number.isInteger(Number(d.guests)) || Number(d.guests) < 0)) return 'Guest count must be a whole number.';
    }
    if (s === 3) return itemErrors(items) ?? adjError(adj);
    if (s === 4) {
      for (const k of ['required', 'paid'] as const) if (dep[k] !== '' && (Number.isNaN(Number(dep[k].replace(/,/g, ''))) || toNum(dep[k]) < 0)) return 'Deposit amounts must be valid, non-negative numbers.';
      if (toNum(dep.paid) > 0) { const e = validatePayment(toNum(dep.paid), total); if (e) return e; }
      if (toNum(dep.required) > total) return 'The deposit required cannot be more than the total.';
      if (dep.dueDate && dep.dueDate > d.date) return 'The payment deadline should be on or before the event date.';
    }
    return null;
  }
  function next() { const e = validate(step); setErr(e); if (!e) setStep(step + 1); }

  async function save() {
    for (let s = 0; s < 5; s++) { const e = validate(s); if (e) { setErr(e); setStep(s); return; } }
    setBusy(true); setErr(null);
    try {
      const a = adjNumbers(adj);
      const paidNow = toNum(dep.paid);
      // One atomic database call: booking + items + checklist + deposit succeed together or not at all.
      const { data: newId, error } = await sb.rpc('create_booking', { p: {
        business_id: business.id, customer_id: customerId, name: d.name.trim(), event_type: eventType, event_date: d.date,
        start_time: d.start || '', end_time: d.end || '', venue: d.venue.trim(), venue_address: d.venueAddress.trim(),
        guest_count: d.guests ? Number(d.guests) : 0, description: d.description.trim(), special_instructions: d.instructions.trim(),
        services, status: paidNow > 0 ? 'deposit_paid' : 'inquiry', ...a,
        deposit_required: toNum(dep.required), payment_due_date: dep.dueDate || '',
        items: items.filter((i) => i.service.trim()).map((i) => ({ service: i.service.trim(), description: i.description.trim(), quantity: toNum(i.quantity), unit_price: toNum(i.unit_price) })),
        deposit: paidNow > 0 ? { amount: paidNow, paid_on: dep.date, method: dep.method, reference: dep.reference.trim() } : null,
      } });
      if (error) throw error;
      if (paidNow > 0) await sb.from('checklist_items').update({ done: true }).eq('event_id', newId as string).eq('label', 'Deposit received');
      router.replace(`/app/events/${newId}`);
    } catch (e) {
      setErr(friendlyError(e, 'Unable to save booking. Please check the details and try again.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="New booking" subtitle={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`} />
      <ol className="flex gap-1.5" aria-label="Progress">
        {STEPS.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} className={cx('h-2 flex-1 rounded-full', i <= step ? 'bg-burgundy' : 'bg-cream-300')}><span className="sr-only">{s}</span></li>)}
      </ol>
      <Card className="space-y-4">
        {step === 0 && (<>
          <TextField label="Find a customer" value={custQ} onChange={(e) => setCustQ(e.target.value)} placeholder="Search by name or phone" type="search" />
          <div className="max-h-72 space-y-2 overflow-y-auto" role="radiogroup" aria-label="Customers">
            {filtered.length === 0 && <p className="text-sm text-charcoal-300">No customers match. Add a new one below.</p>}
            {filtered.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={customerId === c.id} onClick={() => setCustomerId(c.id)}
                className={cx('flex min-h-[56px] w-full items-center justify-between rounded-xl border px-4 text-left', customerId === c.id ? 'border-burgundy bg-burgundy-50' : 'border-charcoal-100 bg-white')}>
                <span><span className="block font-semibold">{c.name}</span><span className="text-xs text-charcoal-300">{c.phone || c.whatsapp}</span></span>
                {customerId === c.id && <Check className="h-5 w-5 text-burgundy" aria-label="Selected" />}
              </button>
            ))}
          </div>
          <Button type="button" variant="secondary" onClick={() => setNewCust(true)}>+ New customer</Button>
          {templates.length > 0 && (
            <SelectField label="Start from a saved package (optional)" defaultValue="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) applyTemplate(t); }}>
              <option value="">No package</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </SelectField>
          )}
        </>)}
        {step === 1 && (<>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Event type">
            {EVENT_TYPES.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)}
                className={cx('min-h-[56px] rounded-xl border px-3 text-sm font-semibold', type === t ? 'border-burgundy bg-burgundy-50 text-burgundy' : 'border-charcoal-100 bg-white')}>{t}</button>
            ))}
          </div>
          {type === 'Other' && <TextField label="What kind of event?" value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="e.g. Engagement, Aqiqah" />}
        </>)}
        {step === 2 && (<>
          <TextField label="Event name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder={customer ? `${customer.name.split(' ')[0]}’s ${eventType}` : 'e.g. Maryam & Ahmed Wedding'} />
          <TextField label="Event date" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Start time" type="time" value={d.start} onChange={(e) => setD({ ...d, start: e.target.value })} />
            <TextField label="End time" type="time" value={d.end} onChange={(e) => setD({ ...d, end: e.target.value })} />
          </div>
          <TextField label="Venue" value={d.venue} onChange={(e) => setD({ ...d, venue: e.target.value })} />
          <TextField label="Venue address" value={d.venueAddress} onChange={(e) => setD({ ...d, venueAddress: e.target.value })} />
          <TextField label="Number of guests" inputMode="numeric" value={d.guests} onChange={(e) => setD({ ...d, guests: e.target.value })} />
          <TextArea label="Event description (optional)" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          <TextArea label="Special instructions (optional)" value={d.instructions} onChange={(e) => setD({ ...d, instructions: e.target.value })} />
        </>)}
        {step === 3 && (<>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-charcoal-400">Services included</legend>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([...(business.services ?? []), ...SERVICE_OPTIONS])).map((s) => {
                const on = services.includes(s);
                return <button key={s} type="button" aria-pressed={on} onClick={() => setServices(on ? services.filter((x) => x !== s) : [...services, s])}
                  className={cx('min-h-[44px] rounded-full border px-4 text-sm font-semibold', on ? 'border-emerald bg-emerald-50 text-emerald-700' : 'border-charcoal-100 bg-white')}>{on ? '✓ ' : ''}{s}</button>;
              })}
            </div>
          </fieldset>
          <ItemsEditor items={items} onChange={setItems} />
          <AdjustmentsEditor adj={adj} onChange={setAdj} items={items} />
        </>)}
        {step === 4 && (<>
          <p className="rounded-xl bg-cream-100 p-3 text-sm">Total for this booking: <strong>₦{total.toLocaleString('en-NG')}</strong></p>
          <TextField label="Deposit required (₦)" inputMode="decimal" value={dep.required} onChange={(e) => setDep({ ...dep, required: e.target.value })} />
          <TextField label="Amount paid so far (₦)" inputMode="decimal" value={dep.paid} onChange={(e) => setDep({ ...dep, paid: e.target.value })} hint="Leave blank if nothing has been paid yet." />
          {toNum(dep.paid) > 0 && (<>
            <SelectField label="Payment method" value={dep.method} onChange={(e) => setDep({ ...dep, method: e.target.value })}>
              <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="pos">POS</option><option value="other">Other</option>
            </SelectField>
            <TextField label="Payment date" type="date" value={dep.date} onChange={(e) => setDep({ ...dep, date: e.target.value })} />
            <TextField label="Reference (optional)" value={dep.reference} onChange={(e) => setDep({ ...dep, reference: e.target.value })} />
          </>)}
          <TextField label="Payment deadline" type="date" value={dep.dueDate} onChange={(e) => setDep({ ...dep, dueDate: e.target.value })} hint="When the balance should be settled." />
        </>)}
        {step === 5 && (
          <div className="space-y-3 text-sm">
            <h2 className="font-display text-2xl">{d.name}</h2>
            <p>{customer?.name} · {eventType} · {d.date} · {d.guests || 0} guests</p>
            <p>{services.join(', ') || 'No services selected'}</p>
            <dl className="rounded-2xl bg-cream-100 p-4">
              <div className="flex justify-between"><dt>Total</dt><dd className="font-semibold">₦{total.toLocaleString('en-NG')}</dd></div>
              <div className="flex justify-between"><dt>Paid now</dt><dd className="font-semibold">₦{toNum(dep.paid).toLocaleString('en-NG')}</dd></div>
              <div className="flex justify-between border-t border-charcoal-100 pt-2 font-display text-xl"><dt>Balance</dt><dd>₦{(total - toNum(dep.paid)).toLocaleString('en-NG')}</dd></div>
            </dl>
          </div>
        )}
        {err && <ErrorBox message={err} />}
        <div className="flex gap-3 pt-1">
          {step > 0 ? <Button variant="secondary" className="flex-1" onClick={() => { setErr(null); setStep(step - 1); }}>Back</Button> : <Link href="/app/events" className="flex-1"><Button variant="secondary" className="w-full">Cancel</Button></Link>}
          {step < STEPS.length - 1 ? <Button className="flex-1" onClick={next}>Continue</Button> : <Button className="flex-1" loading={busy} loadingText="Saving..." onClick={save}>Save booking</Button>}
        </div>
      </Card>
      <Modal open={newCust} onClose={() => setNewCust(false)} title="New customer">
        <CustomerForm businessId={business.id} onCancel={() => setNewCust(false)} onSaved={(c) => { setCustomers((p) => [...p, c]); setCustomerId(c.id); setNewCust(false); }} />
      </Modal>
    </div>
  );
}
export default function NewBooking() { return <Suspense><Wizard /></Suspense>; }

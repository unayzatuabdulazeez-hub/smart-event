'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { grandTotal, subtotal, formatNaira, validatePayment } from '@/lib/money';
import { money } from '@/lib/validation';
import { EVENT_TYPES, SERVICE_OPTIONS } from '@/lib/status';
import { todayStr } from '@/lib/dates';
import type { Customer, EventRow } from '@/lib/types';
import CustomerForm from './CustomerForm';
import { Button, Card, ErrorBox, Modal, SelectField, TextArea, TextField, cx } from './ui';

interface Line { service: string; description: string; quantity: string; unit_price: string }
export interface WizardInitial {
  event: EventRow; items: { service: string; description: string | null; quantity: number; unit_price: number }[];
}
const STEPS = ['Customer', 'Event', 'Details', 'Services', 'Pricing', 'Deposit', 'Review'];

export default function BookingWizard({ businessId, enabledServices, presetCustomerId, initial }: {
  businessId: string; enabledServices: string[]; presetCustomerId?: string | null; initial?: WizardInitial;
}) {
  const router = useRouter();
  const editing = !!initial;
  const ev = initial?.event;
  const [step, setStep] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cq, setCq] = useState('');
  const [customerId, setCustomerId] = useState<string>(ev?.customer_id ?? presetCustomerId ?? '');
  const [newCust, setNewCust] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string; event_type: string; guest_count: number; services: string[]; items: { service: string; description?: string; quantity: number; unit_price: number }[] }[]>([]);

  const knownType = ev ? EVENT_TYPES.includes(ev.event_type) : true;
  const [typeSel, setTypeSel] = useState(ev ? (knownType ? ev.event_type : 'Other') : 'Wedding');
  const [customType, setCustomType] = useState(ev && !knownType ? ev.event_type : '');
  const [d, setD] = useState({
    name: ev?.name ?? '', date: ev?.event_date ?? '', start: ev?.start_time?.slice(0, 5) ?? '', end: ev?.end_time?.slice(0, 5) ?? '',
    venue: ev?.venue ?? '', venueAddress: ev?.venue_address ?? '', guests: ev ? String(ev.guest_count) : '', description: ev?.description ?? '', instructions: ev?.special_instructions ?? '',
  });
  const [services, setServices] = useState<string[]>(ev?.services ?? []);
  const [lines, setLines] = useState<Line[]>(initial?.items.length
    ? initial.items.map((i) => ({ service: i.service, description: i.description ?? '', quantity: String(i.quantity), unit_price: String(i.unit_price) }))
    : []);
  const [adj, setAdj] = useState({
    discount: ev ? String(ev.discount) : '', additional: ev ? String(ev.additional_charges) : '', delivery: ev ? String(ev.delivery_fee) : '', service: ev ? String(ev.service_fee) : '',
  });
  const [dep, setDep] = useState({ required: ev ? String(ev.deposit_required) : '', paid: '', method: 'bank_transfer', date: todayStr(), reference: '', due: ev?.payment_due_date ?? '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const [{ data: c }, { data: t }] = await Promise.all([
        sb.from('customers').select('*').eq('business_id', businessId).order('name').limit(300),
        editing ? Promise.resolve({ data: [] }) : sb.from('event_templates').select('*').eq('business_id', businessId).order('name'),
      ]);
      setCustomers((c ?? []) as Customer[]);
      setTemplates((t ?? []) as typeof templates);
    })();
  }, [businessId, editing]);

  const parsed = useMemo(() => {
    const items = lines.map((l) => ({ quantity: money(l.quantity), unit_price: money(l.unit_price) }));
    const a = { discount: money(adj.discount || '0'), additional_charges: money(adj.additional || '0'), delivery_fee: money(adj.delivery || '0'), service_fee: money(adj.service || '0') };
    const clean = items.map((i) => ({ quantity: Number.isFinite(i.quantity) ? i.quantity : 0, unit_price: Number.isFinite(i.unit_price) ? i.unit_price : 0 }));
    const adjClean = Object.fromEntries(Object.entries(a).map(([k, v]) => [k, Number.isFinite(v) ? v : 0]));
    return { sub: subtotal(clean), total: grandTotal(clean, adjClean), adj: adjClean as typeof a };
  }, [lines, adj]);

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTypeSel(EVENT_TYPES.includes(t.event_type) ? t.event_type : 'Other');
    if (!EVENT_TYPES.includes(t.event_type)) setCustomType(t.event_type);
    setD((p) => ({ ...p, guests: String(t.guest_count || '') }));
    setServices(t.services ?? []);
    setLines((t.items ?? []).map((i) => ({ service: i.service, description: i.description ?? '', quantity: String(i.quantity), unit_price: String(i.unit_price) })));
  }

  function toggleService(s: string) {
    setServices((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  }

  function validate(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0 && !customerId) e.customer = 'Choose a customer or add a new one.';
    if (s === 1 && typeSel === 'Other' && !customType.trim()) e.type = 'Enter the type of event.';
    if (s === 2) {
      if (!d.name.trim()) e.name = 'Give this event a name, e.g. "Maryam & Ahmed Wedding".';
      if (!d.date) e.date = 'Choose the event date.';
      else if (!editing && d.date < todayStr()) e.date = 'The event date is in the past.';
      if (d.start && d.end && d.end <= d.start) e.end = 'End time must be after the start time.';
      if (d.guests !== '' && (!/^\d+$/.test(d.guests) || Number(d.guests) > 100000)) e.guests = 'Enter a whole number of guests.';
    }
    if (s === 4) {
      if (!lines.length) e.lines = 'Add at least one priced item.';
      lines.forEach((l, i) => {
        if (!l.service.trim()) e[`l${i}s`] = 'Name this item.';
        const q = money(l.quantity), p = money(l.unit_price);
        if (!(q > 0)) e[`l${i}q`] = 'Quantity must be more than 0.';
        if (!(p >= 0) || Number.isNaN(p)) e[`l${i}p`] = 'Enter a valid price.';
      });
      (['discount', 'additional', 'delivery', 'service'] as const).forEach((k) => {
        const v = money(adj[k] || '0'); if (Number.isNaN(v) || v < 0) e[k] = 'Enter 0 or more.';
      });
      if (parsed.adj.discount > parsed.sub + parsed.adj.additional_charges + parsed.adj.delivery_fee + parsed.adj.service_fee) e.discount = 'Discount is larger than the total.';
    }
    if (s === 5) {
      const req = money(dep.required || '0'), paid = money(dep.paid || '0');
      if (Number.isNaN(req) || req < 0) e.required = 'Enter 0 or more.';
      else if (req > parsed.total) e.required = 'Deposit cannot be more than the total.';
      if (Number.isNaN(paid) || paid < 0) e.paid = 'Enter 0 or more.';
      else if (!editing && paid > 0) { const m = validatePayment(paid, parsed.total); if (m) e.paid = m; }
      if (dep.due && d.date && dep.due > d.date && !editing) e.due = 'The payment deadline is after the event date.';
    }
    setErrs(e);
    return Object.keys(e).length === 0;
  }

  const next = () => { if (validate(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1)); };

  async function save() {
    for (let s = 0; s <= 5; s++) { if (!validate(s)) { setStep(s); return; } }
    setBusy(true); setError(null);
    try {
      const sb = supabaseBrowser();
      const payload = {
        business_id: businessId, customer_id: customerId, name: d.name.trim(), event_type: typeSel === 'Other' ? customType.trim() : typeSel,
        event_date: d.date, start_time: d.start, end_time: d.end, venue: d.venue.trim(), venue_address: d.venueAddress.trim(),
        guest_count: d.guests === '' ? 0 : Number(d.guests), description: d.description.trim(), special_instructions: d.instructions.trim(),
        services, discount: parsed.adj.discount, additional_charges: parsed.adj.additional_charges, delivery_fee: parsed.adj.delivery_fee, service_fee: parsed.adj.service_fee,
        deposit_required: money(dep.required || '0'), payment_due_date: dep.due,
        items: lines.map((l) => ({ service: l.service.trim(), description: l.description.trim(), quantity: money(l.quantity), unit_price: money(l.unit_price) })),
        deposit: !editing && money(dep.paid || '0') > 0 ? { amount: money(dep.paid), method: dep.method, paid_on: dep.date, reference: dep.reference.trim() } : null,
        status: !editing && money(dep.paid || '0') > 0 ? 'deposit_paid' : 'inquiry',
      };
      if (editing) {
        const { error: e } = await sb.rpc('update_booking', { p_event_id: ev!.id, p: payload });
        if (e) throw e;
        router.push(`/app/events/${ev!.id}`);
      } else {
        const { data, error: e } = await sb.rpc('create_booking', { p: payload });
        if (e) throw e;
        router.push(`/app/events/${data as string}`);
      }
      router.refresh();
    } catch (err) {
      setError(friendlyError(err, 'Unable to save booking. Please try again.'));
    } finally { setBusy(false); }
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const shown = customers.filter((c) => !cq.trim() || c.name.toLowerCase().includes(cq.toLowerCase()) || (c.phone ?? '').includes(cq) || (c.whatsapp ?? '').includes(cq));

  return (
    <div>
      <ol className="mb-6 flex gap-1" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1" aria-current={i === step ? 'step' : undefined}>
            <span className={cx('block h-1.5 rounded-full', i <= step ? 'bg-burgundy' : 'bg-cream-300')} />
            <span className={cx('mt-1 hidden text-[11px] font-semibold sm:block', i === step ? 'text-burgundy' : 'text-charcoal-200')}>{s}</span>
          </li>
        ))}
      </ol>
      <p className="mb-4 text-sm font-semibold text-gold-600 sm:hidden">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>

      {step === 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl">Who is this booking for?</h2>
          {templates.length > 0 && (
            <SelectField label="Start from a template (optional)" defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">No template</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </SelectField>
          )}
          {selectedCustomer && <Card className="border-emerald"><p className="text-xs font-semibold text-emerald">Selected</p><p className="font-semibold">{selectedCustomer.name}</p><p className="text-sm text-charcoal-300">{selectedCustomer.whatsapp || selectedCustomer.phone}</p></Card>}
          <TextField label="Find a customer" type="search" placeholder="Search by name or phone" value={cq} onChange={(e) => setCq(e.target.value)} />
          <ul className="max-h-64 space-y-2 overflow-y-auto" aria-label="Customers">
            {shown.slice(0, 40).map((c) => (
              <li key={c.id}><button type="button" onClick={() => setCustomerId(c.id)} aria-pressed={customerId === c.id}
                className={cx('flex min-h-[52px] w-full items-center justify-between rounded-xl border px-4 text-left', customerId === c.id ? 'border-burgundy bg-burgundy-50' : 'border-charcoal-100 bg-white')}>
                <span className="font-semibold">{c.name}</span><span className="text-sm text-charcoal-300">{c.whatsapp || c.phone}</span></button></li>
            ))}
            {shown.length === 0 && <li className="text-sm text-charcoal-300">No customers match. Add a new one below.</li>}
          </ul>
          <Button variant="secondary" onClick={() => setNewCust(true)}><UserPlus className="h-4 w-4" aria-hidden /> New customer</Button>
          {errs.customer && <p role="alert" className="text-sm font-semibold text-coral-600">{errs.customer}</p>}
        </section>
      )}

      {step === 1 && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl">What kind of event is it?</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {EVENT_TYPES.map((t) => (
              <button key={t} type="button" aria-pressed={typeSel === t} onClick={() => setTypeSel(t)}
                className={cx('min-h-[56px] rounded-xl border px-3 text-sm font-semibold', typeSel === t ? 'border-burgundy bg-burgundy text-white' : 'border-charcoal-100 bg-white')}>{t}</button>
            ))}
          </div>
          {typeSel === 'Other' && <TextField label="Type of event" placeholder="e.g. Engagement, Aqiqah" value={customType} onChange={(e) => setCustomType(e.target.value)} error={errs.type} />}
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl">Event details</h2>
          <TextField label="Event name" placeholder="Maryam & Ahmed Wedding" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} error={errs.name} />
          <TextField label="Event date" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} error={errs.date} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Start time" type="time" value={d.start} onChange={(e) => setD({ ...d, start: e.target.value })} />
            <TextField label="End time" type="time" value={d.end} onChange={(e) => setD({ ...d, end: e.target.value })} error={errs.end} />
          </div>
          <TextField label="Venue" value={d.venue} onChange={(e) => setD({ ...d, venue: e.target.value })} />
          <TextField label="Venue address" value={d.venueAddress} onChange={(e) => setD({ ...d, venueAddress: e.target.value })} />
          <TextField label="Number of guests" inputMode="numeric" value={d.guests} onChange={(e) => setD({ ...d, guests: e.target.value })} error={errs.guests} />
          <TextArea label="Event description" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          <TextArea label="Special instructions" hint="Private. Only you can see this." value={d.instructions} onChange={(e) => setD({ ...d, instructions: e.target.value })} />
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl">Which services?</h2>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set([...enabledServices, ...SERVICE_OPTIONS, ...services])).map((s) => (
              <button key={s} type="button" aria-pressed={services.includes(s)} onClick={() => toggleService(s)}
                className={cx('min-h-[44px] rounded-full border px-4 text-sm font-semibold', services.includes(s) ? 'border-burgundy bg-burgundy text-white' : 'border-charcoal-100 bg-white')}>
                {services.includes(s) ? '✓ ' : ''}{s}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl">Pricing</h2>
          {lines.length === 0 && services.length > 0 && (
            <Button variant="secondary" onClick={() => setLines(services.map((s) => ({ service: s, description: '', quantity: d.guests || '1', unit_price: '' })))}>Add a line for each selected service</Button>
          )}
          {lines.map((l, i) => (
            <Card key={i} className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-1"><TextField label="Item" value={l.service} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, service: e.target.value } : x))} error={errs[`l${i}s`]} /></div>
                <button type="button" aria-label={`Remove ${l.service || 'item'}`} onClick={() => setLines(lines.filter((_, j) => j !== i))} className="mt-7 grid h-12 w-12 place-items-center rounded-xl text-coral-600 hover:bg-coral-50"><Trash2 className="h-5 w-5" aria-hidden /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Quantity" inputMode="decimal" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} error={errs[`l${i}q`]} />
                <TextField label="Unit price (₦)" inputMode="decimal" value={l.unit_price} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))} error={errs[`l${i}p`]} />
              </div>
              <p className="text-right text-sm font-semibold">Line total: {formatNaira(subtotal([{ quantity: money(l.quantity) || 0, unit_price: money(l.unit_price) || 0 }]))}</p>
            </Card>
          ))}
          <Button variant="secondary" onClick={() => setLines([...lines, { service: '', description: '', quantity: '1', unit_price: '' }])}><Plus className="h-4 w-4" aria-hidden /> Add item</Button>
          {errs.lines && <p role="alert" className="text-sm font-semibold text-coral-600">{errs.lines}</p>}
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Discount (₦)" inputMode="decimal" value={adj.discount} onChange={(e) => setAdj({ ...adj, discount: e.target.value })} error={errs.discount} />
            <TextField label="Additional charges (₦)" inputMode="decimal" value={adj.additional} onChange={(e) => setAdj({ ...adj, additional: e.target.value })} error={errs.additional} />
            <TextField label="Delivery fee (₦)" inputMode="decimal" value={adj.delivery} onChange={(e) => setAdj({ ...adj, delivery: e.target.value })} error={errs.delivery} />
            <TextField label="Service fee (₦)" inputMode="decimal" value={adj.service} onChange={(e) => setAdj({ ...adj, service: e.target.value })} error={errs.service} />
          </div>
          <Card className="space-y-1 bg-cream-50">
            <p className="flex justify-between text-sm"><span>Subtotal</span><span>{formatNaira(parsed.sub)}</span></p>
            {parsed.adj.discount > 0 && <p className="flex justify-between text-sm"><span>Discount</span><span>-{formatNaira(parsed.adj.discount)}</span></p>}
            {(parsed.adj.additional_charges + parsed.adj.delivery_fee + parsed.adj.service_fee) > 0 && <p className="flex justify-between text-sm"><span>Additional charges</span><span>{formatNaira(parsed.adj.additional_charges + parsed.adj.delivery_fee + parsed.adj.service_fee)}</span></p>}
            <p className="flex justify-between border-t border-cream-300 pt-2 font-display text-xl"><span>Grand total</span><span className="text-burgundy">{formatNaira(parsed.total)}</span></p>
          </Card>
        </section>
      )}

      {step === 5 && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl">{editing ? 'Deposit & deadline' : 'Deposit & due date'}</h2>
          <TextField label="Deposit required (₦)" inputMode="decimal" value={dep.required} onChange={(e) => setDep({ ...dep, required: e.target.value })} error={errs.required} />
          {!editing && (
            <>
              <TextField label="Amount paid now (₦)" inputMode="decimal" hint="Leave blank if nothing has been paid yet." value={dep.paid} onChange={(e) => setDep({ ...dep, paid: e.target.value })} error={errs.paid} />
              {money(dep.paid || '0') > 0 && (
                <>
                  <SelectField label="Payment method" value={dep.method} onChange={(e) => setDep({ ...dep, method: e.target.value })}>
                    <option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="pos">POS</option><option value="other">Other</option>
                  </SelectField>
                  <TextField label="Payment date" type="date" value={dep.date} onChange={(e) => setDep({ ...dep, date: e.target.value })} />
                  <TextField label="Reference (optional)" value={dep.reference} onChange={(e) => setDep({ ...dep, reference: e.target.value })} />
                </>
              )}
            </>
          )}
          <TextField label="Payment deadline" type="date" value={dep.due} onChange={(e) => setDep({ ...dep, due: e.target.value })} error={errs.due} />
          <Card className="bg-cream-50"><p className="flex justify-between"><span>Total</span><b>{formatNaira(parsed.total)}</b></p>
            {!editing && <><p className="flex justify-between"><span>Paid</span><b className="text-emerald">{formatNaira(money(dep.paid || '0') || 0)}</b></p>
              <p className="flex justify-between border-t border-cream-300 pt-1"><span>Balance</span><b className="text-burgundy">{formatNaira(parsed.total - (money(dep.paid || '0') || 0))}</b></p></>}</Card>
        </section>
      )}

      {step === 6 && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl">Review & save</h2>
          <Card className="space-y-2">
            <p className="font-display text-xl">{d.name}</p>
            <p className="text-sm text-charcoal-300">{selectedCustomer?.name} · {typeSel === 'Other' ? customType : typeSel}</p>
            <p className="text-sm">{d.date} {d.start && `· ${d.start}`} {d.venue && `· ${d.venue}`}</p>
            <p className="text-sm">{d.guests || 0} guests · {services.join(', ') || 'No services selected'}</p>
            <p className="border-t border-cream-300 pt-2 font-display text-xl">Total {formatNaira(parsed.total)}</p>
          </Card>
          {error && <ErrorBox message={error} />}
        </section>
      )}

      <div className="mt-8 flex gap-3">
        {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={busy}>Back</Button>}
        {step < STEPS.length - 1
          ? <Button className="flex-1" onClick={next}>Continue</Button>
          : <Button className="flex-1" onClick={save} loading={busy} loadingText="Saving...">{editing ? 'Save changes' : 'Save booking'}</Button>}
      </div>

      <Modal open={newCust} onClose={() => setNewCust(false)} title="New customer">
        <CustomerForm businessId={businessId} onCancel={() => setNewCust(false)}
          onSaved={(c) => { setCustomers((p) => [c, ...p]); setCustomerId(c.id); setNewCust(false); }} />
      </Modal>
    </div>
  );
}

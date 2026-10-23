'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { formatNaira, grandTotal, subtotal } from '@/lib/money';
import { money } from '@/lib/validation';
import { addDaysStr, todayStr } from '@/lib/dates';
import type { Customer } from '@/lib/types';
import { Button, Card, ErrorBox, SelectField, TextArea, TextField } from './ui';

interface Line { service: string; quantity: string; unit_price: string }
export interface QuoteInitial {
  id: string; customer_id: string; event_id: string | null; title: string; expiry_date: string | null; discount: number;
  additional_charges: number; deposit_required: number; terms: string | null; notes: string | null; items: { service: string; quantity: number; unit_price: number }[];
}
export const DEFAULT_TERMS = 'A deposit is required to confirm your booking. The balance is due before the event date. Prices are valid until the quote expiry date. Changes to guest count or menu may change the final price.';

export default function QuoteEditor({ businessId, initial, eventId }: { businessId: string; initial?: QuoteInitial; eventId?: string | null }) {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [f, setF] = useState({
    customer: initial?.customer_id ?? '', title: initial?.title ?? '', expiry: initial?.expiry_date ?? addDaysStr(todayStr(), 14),
    discount: initial ? String(initial.discount) : '', additional: initial ? String(initial.additional_charges) : '',
    deposit: initial ? String(initial.deposit_required) : '', terms: initial?.terms ?? DEFAULT_TERMS, notes: initial?.notes ?? '',
    eventId: initial?.event_id ?? eventId ?? '',
  });
  const [lines, setLines] = useState<Line[]>(initial?.items.map((i) => ({ service: i.service, quantity: String(i.quantity), unit_price: String(i.unit_price) })) ?? [{ service: '', quantity: '1', unit_price: '' }]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data: c } = await sb.from('customers').select('*').eq('business_id', businessId).order('name').limit(300);
      setCustomers((c ?? []) as Customer[]);
      // Prefill from a booking
      if (!initial && eventId) {
        const [{ data: ev }, { data: items }] = await Promise.all([
          sb.from('events').select('customer_id,name,discount,additional_charges,delivery_fee,service_fee,deposit_required').eq('id', eventId).maybeSingle(),
          sb.from('booking_items').select('service,quantity,unit_price').eq('event_id', eventId).order('sort'),
        ]);
        if (ev) {
          setF((p) => ({ ...p, customer: ev.customer_id as string, title: ev.name as string, discount: String(ev.discount || ''),
            additional: String(Number(ev.additional_charges) + Number(ev.delivery_fee) + Number(ev.service_fee) || ''), deposit: String(ev.deposit_required || '') }));
          if (items?.length) setLines(items.map((i) => ({ service: i.service as string, quantity: String(i.quantity), unit_price: String(i.unit_price) })));
        }
      }
    })();
  }, [businessId, eventId, initial]);

  const totals = useMemo(() => {
    const clean = lines.map((l) => ({ quantity: money(l.quantity) || 0, unit_price: money(l.unit_price) || 0 }));
    const discount = money(f.discount || '0') || 0, add = money(f.additional || '0') || 0;
    const total = grandTotal(clean, { discount, additional_charges: add });
    const dep = money(f.deposit || '0') || 0;
    return { sub: subtotal(clean), total, deposit: dep, balance: total - dep };
  }, [lines, f.discount, f.additional, f.deposit]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.customer) er.customer = 'Choose a customer.';
    if (!f.title.trim()) er.title = 'Give the quote a title, e.g. the event name.';
    lines.forEach((l, i) => {
      if (!l.service.trim()) er[`s${i}`] = 'Name this item.';
      if (!(money(l.quantity) > 0)) er[`q${i}`] = 'Quantity must be more than 0.';
      const p = money(l.unit_price); if (Number.isNaN(p) || p < 0) er[`p${i}`] = 'Enter a valid price.';
    });
    (['discount', 'additional', 'deposit'] as const).forEach((k) => { const v = money(f[k] || '0'); if (Number.isNaN(v) || v < 0) er[k] = 'Enter 0 or more.'; });
    if (totals.deposit > totals.total) er.deposit = 'Deposit cannot be more than the total.';
    if (f.expiry && f.expiry < todayStr() && !initial) er.expiry = 'The expiry date is in the past.';
    setErrs(er); if (Object.keys(er).length) return;
    setBusy(true); setError(null);
    try {
      const payload = {
        business_id: businessId, customer_id: f.customer, event_id: f.eventId || null, title: f.title.trim(), expiry_date: f.expiry,
        discount: money(f.discount || '0'), additional_charges: money(f.additional || '0'), deposit_required: money(f.deposit || '0'),
        terms: f.terms.trim(), notes: f.notes.trim(),
        items: lines.map((l) => ({ service: l.service.trim(), quantity: money(l.quantity), unit_price: money(l.unit_price) })),
      };
      const sb = supabaseBrowser();
      if (initial) {
        const { error: x } = await sb.rpc('update_quote', { p_quote_id: initial.id, p: payload });
        if (x) throw x;
        router.push(`/app/quotes/${initial.id}`);
      } else {
        const { data, error: x } = await sb.rpc('create_quote', { p: payload });
        if (x) throw x;
        router.push(`/app/quotes/${data as string}`);
      }
      router.refresh();
    } catch (x) { setError(friendlyError(x, 'Unable to save quote. Please try again.')); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      <SelectField label="Customer" value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} error={errs.customer}>
        <option value="">Choose a customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </SelectField>
      <TextField label="Quote title" placeholder="Maryam & Ahmed Wedding" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} error={errs.title} />
      {lines.map((l, i) => (
        <Card key={i} className="space-y-3">
          <div className="flex items-start gap-2">
            <div className="flex-1"><TextField label="Item" value={l.service} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, service: e.target.value } : x))} error={errs[`s${i}`]} /></div>
            {lines.length > 1 && <button type="button" aria-label="Remove item" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="mt-7 grid h-12 w-12 place-items-center rounded-xl text-coral-600 hover:bg-coral-50"><Trash2 className="h-5 w-5" aria-hidden /></button>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Quantity" inputMode="decimal" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} error={errs[`q${i}`]} />
            <TextField label="Unit price (₦)" inputMode="decimal" value={l.unit_price} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))} error={errs[`p${i}`]} />
          </div>
        </Card>
      ))}
      <Button type="button" variant="secondary" onClick={() => setLines([...lines, { service: '', quantity: '1', unit_price: '' }])}><Plus className="h-4 w-4" aria-hidden /> Add item</Button>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Discount (₦)" inputMode="decimal" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} error={errs.discount} />
        <TextField label="Additional charges (₦)" inputMode="decimal" value={f.additional} onChange={(e) => setF({ ...f, additional: e.target.value })} error={errs.additional} />
        <TextField label="Deposit required (₦)" inputMode="decimal" value={f.deposit} onChange={(e) => setF({ ...f, deposit: e.target.value })} error={errs.deposit} />
        <TextField label="Quote expires" type="date" value={f.expiry} onChange={(e) => setF({ ...f, expiry: e.target.value })} error={errs.expiry} />
      </div>
      <Card className="space-y-1 bg-cream-50">
        <p className="flex justify-between text-sm"><span>Subtotal</span><span>{formatNaira(totals.sub)}</span></p>
        <p className="flex justify-between font-display text-xl"><span>Grand total</span><span className="text-burgundy">{formatNaira(totals.total)}</span></p>
        <p className="flex justify-between text-sm"><span>Deposit</span><span>{formatNaira(totals.deposit)}</span></p>
        <p className="flex justify-between text-sm"><span>Balance after deposit</span><span>{formatNaira(totals.balance)}</span></p>
      </Card>
      <TextArea label="Terms and conditions" rows={5} value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} />
      <TextArea label="Notes for the customer (optional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      {error && <ErrorBox message={error} />}
      <Button type="submit" className="w-full" loading={busy} loadingText="Saving...">{initial ? 'Save quote' : 'Create quote'}</Button>
    </form>
  );
}

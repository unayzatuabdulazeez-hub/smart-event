'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBusiness } from './BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must } from '@/lib/useQuery';
import { friendlyError } from '@/lib/errors';
import { grandTotal } from '@/lib/money';
import { addDaysStr, todayStr } from '@/lib/dates';
import type { Customer } from '@/lib/types';
import { Button, Card, ErrorBox, ListSkeleton, SelectField, TextArea, TextField } from './ui';
import ItemsEditor, { emptyItem, itemErrors, itemsToNumbers, toNum, type ItemDraft } from './ItemsEditor';
import AdjustmentsEditor, { adjError, adjNumbers, emptyAdj, type AdjDraft } from './AdjustmentsEditor';

export const DEFAULT_TERMS = 'A deposit is required to confirm your booking. The balance is due before the event date. Prices are valid until the quote expiry date. Changes to guest count or menu after confirmation may affect the final price.';

export default function QuoteForm({ quoteId, presetEventId }: { quoteId?: string; presetEventId?: string | null }) {
  const { business } = useBusiness();
  const router = useRouter();
  const sb = supabaseBrowser();
  const [ready, setReady] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [events, setEvents] = useState<{ id: string; name: string; customer_id: string }[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [eventId, setEventId] = useState(presetEventId ?? '');
  const [title, setTitle] = useState('');
  const [issue, setIssue] = useState(todayStr());
  const [expiry, setExpiry] = useState(addDaysStr(todayStr(), 14));
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [adj, setAdj] = useState<AdjDraft>(emptyAdj());
  const [deposit, setDeposit] = useState('');
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, e] = await Promise.all([
          sb.from('customers').select('*').eq('business_id', business.id).order('name').limit(500),
          sb.from('events').select('id,name,customer_id').eq('business_id', business.id).neq('status', 'cancelled').order('event_date', { ascending: false }).limit(200),
        ]);
        setCustomers(must(c) as Customer[]); setEvents(must(e) as any[]);
        if (quoteId) {
          const q = must(await sb.from('quotes').select('*').eq('id', quoteId).eq('business_id', business.id).single()) as any;
          const qi = must(await sb.from('quote_items').select('*').eq('quote_id', quoteId).order('sort')) as any[];
          setCustomerId(q.customer_id); setEventId(q.event_id ?? ''); setTitle(q.title); setIssue(q.issue_date); setExpiry(q.expiry_date ?? '');
          setItems(qi.map((i) => ({ service: i.service, description: i.description ?? '', quantity: String(i.quantity), unit_price: String(i.unit_price) })));
          setAdj({ ...emptyAdj(), discount: q.discount ? String(q.discount) : '', additional_charges: q.additional_charges ? String(q.additional_charges) : '' });
          setDeposit(q.deposit_required ? String(q.deposit_required) : ''); setTerms(q.terms ?? ''); setNotes(q.notes ?? '');
        } else if (presetEventId) {
          await prefillFromEvent(presetEventId);
        }
        setReady(true);
      } catch (x) { setErr(friendlyError(x, 'Unable to load this form.')); setReady(true); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id, quoteId]);

  async function prefillFromEvent(id: string) {
    const ev = must(await sb.from('events').select('*').eq('id', id).eq('business_id', business.id).single()) as any;
    const bi = must(await sb.from('booking_items').select('*').eq('event_id', id).order('sort')) as any[];
    setEventId(id); setCustomerId(ev.customer_id); setTitle(ev.name);
    setItems(bi.length ? bi.map((i) => ({ service: i.service, description: i.description ?? '', quantity: String(i.quantity), unit_price: String(i.unit_price) })) : [emptyItem()]);
    setAdj({ ...emptyAdj(), discount: ev.discount ? String(ev.discount) : '', additional_charges: String(Number(ev.additional_charges) + Number(ev.delivery_fee) + Number(ev.service_fee) || '') });
    setDeposit(ev.deposit_required ? String(ev.deposit_required) : '');
  }

  const nums = itemsToNumbers(items);
  const total = grandTotal(nums, adjNumbers(adj));

  async function save() {
    if (!customerId) return setErr('Choose a customer.');
    if (!title.trim()) return setErr('Give the quote a title, e.g. the event name.');
    if (!issue) return setErr('Choose the issue date.');
    if (expiry && expiry < issue) return setErr('The expiry date must be after the issue date.');
    const ie = itemErrors(items) ?? adjError(adj); if (ie) return setErr(ie);
    if (deposit !== '' && (Number.isNaN(Number(deposit.replace(/,/g, ''))) || toNum(deposit) < 0)) return setErr('Enter a valid deposit amount.');
    if (toNum(deposit) > total) return setErr('The deposit cannot be more than the total.');
    setBusy(true); setErr(null);
    try {
      const a = adjNumbers(adj);
      const payload = {
        customer_id: customerId, event_id: eventId || '', title: title.trim(), issue_date: issue, expiry_date: expiry || '',
        discount: a.discount, additional_charges: a.additional_charges + a.delivery_fee + a.service_fee, deposit_required: toNum(deposit),
        terms: terms.trim(), notes: notes.trim(),
        items: items.filter((i) => i.service.trim()).map((i) => ({ service: i.service.trim(), description: i.description.trim(), quantity: toNum(i.quantity), unit_price: toNum(i.unit_price) })),
      };
      let id = quoteId;
      // Atomic: the quote and all of its lines are saved together or not at all.
      if (quoteId) {
        const r = await sb.rpc('update_quote', { p_quote_id: quoteId, p: payload }); if (r.error) throw r.error;
        const d = await sb.from('quotes').update({ issue_date: issue }).eq('id', quoteId); if (d.error) throw d.error;
      } else {
        const r = await sb.rpc('create_quote', { p: { ...payload, business_id: business.id } }); if (r.error) throw r.error; id = r.data as string;
      }
      router.replace(`/app/quotes/${id}`);
    } catch (x) { setErr(friendlyError(x, 'Unable to save the quote.')); } finally { setBusy(false); }
  }

  if (!ready) return <ListSkeleton rows={3} />;
  const evOptions = events.filter((e) => !customerId || e.customer_id === customerId);
  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <SelectField label="Customer" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setEventId(''); }}>
          <option value="">Choose a customer…</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        <SelectField label="Booking (optional)" value={eventId} onChange={async (e) => { const v = e.target.value; setEventId(v); if (v && !quoteId) { try { await prefillFromEvent(v); } catch (x) { setErr(friendlyError(x)); } } }}>
          <option value="">Not linked to a booking</option>{evOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </SelectField>
        <TextField label="Quote title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Maryam & Ahmed Wedding" />
        <div className="grid grid-cols-2 gap-3"><TextField label="Issue date" type="date" value={issue} onChange={(e) => setIssue(e.target.value)} /><TextField label="Valid until" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></div>
      </Card>
      <Card className="space-y-4"><h2 className="font-display text-xl">Services &amp; prices</h2><ItemsEditor items={items} onChange={setItems} />
        <AdjustmentsEditor adj={adj} onChange={setAdj} items={items} />
        <TextField label="Deposit required (₦)" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} hint={`Balance after deposit: ₦${Math.max(total - toNum(deposit), 0).toLocaleString('en-NG')}`} /></Card>
      <Card className="space-y-4"><TextArea label="Terms and conditions" rows={5} value={terms} onChange={(e) => setTerms(e.target.value)} /><TextArea label="Note to customer (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} /></Card>
      {err && <ErrorBox message={err} />}
      <div className="flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => router.back()}>Cancel</Button><Button className="flex-1" loading={busy} loadingText="Saving..." onClick={save}>{quoteId ? 'Save changes' : 'Save quote'}</Button></div>
    </div>
  );
}

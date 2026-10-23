'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { grandTotal } from '@/lib/money';
import { EVENT_TYPES, SERVICE_OPTIONS } from '@/lib/status';
import type { BookingItem, EventRow } from '@/lib/types';
import { Button, ErrorBox, Modal, SelectField, TextArea, TextField, Toggle, cx } from '../ui';
import ItemsEditor, { itemErrors, itemsToNumbers, toNum, type ItemDraft } from '../ItemsEditor';
import AdjustmentsEditor, { adjError, adjNumbers, type AdjDraft } from '../AdjustmentsEditor';

const str = (n: number) => (n ? String(n) : '');

export default function EditEventModal({ open, onClose, event, items, paid, onSaved }: {
  open: boolean; onClose: () => void; event: EventRow; items: BookingItem[]; paid: number; onSaved: () => void;
}) {
  const [d, setD] = useState({
    name: event.name, type: event.event_type, date: event.event_date, start: event.start_time?.slice(0, 5) ?? '', end: event.end_time?.slice(0, 5) ?? '',
    venue: event.venue ?? '', venueAddress: event.venue_address ?? '', guests: String(event.guest_count ?? 0), description: event.description ?? '',
    instructions: event.special_instructions ?? '', deposit: str(event.deposit_required), due: event.payment_due_date ?? '', allowOver: event.allow_overpayment,
  });
  const [services, setServices] = useState<string[]>(event.services ?? []);
  const [rows, setRows] = useState<ItemDraft[]>(items.length ? items.map((i) => ({ service: i.service, description: i.description ?? '', quantity: String(i.quantity), unit_price: String(i.unit_price) })) : [{ service: '', description: '', quantity: '1', unit_price: '' }]);
  const [adj, setAdj] = useState<AdjDraft>({ discount: str(event.discount), additional_charges: str(event.additional_charges), delivery_fee: str(event.delivery_fee), service_fee: str(event.service_fee) });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const types = EVENT_TYPES.includes(d.type) ? EVENT_TYPES : [...EVENT_TYPES, d.type];

  async function save() {
    if (!d.name.trim()) return setErr('Give the event a name.');
    if (!d.date) return setErr('Choose the event date.');
    if (d.start && d.end && d.end < d.start) return setErr('The end time must be after the start time.');
    if (!Number.isInteger(Number(d.guests || 0)) || Number(d.guests || 0) < 0) return setErr('Guest count must be a whole number.');
    const ie = itemErrors(rows) ?? adjError(adj); if (ie) return setErr(ie);
    const total = grandTotal(itemsToNumbers(rows), adjNumbers(adj));
    if (!d.allowOver && total < paid) return setErr(`The new total (₦${total.toLocaleString('en-NG')}) is less than the ₦${paid.toLocaleString('en-NG')} already paid. Allow overpayment or adjust the prices.`);
    setBusy(true); setErr(null);
    const sb = supabaseBrowser();
    try {
      // Atomic: event fields and the full set of line items are replaced in one transaction.
      const { error } = await sb.rpc('update_booking', { p_event_id: event.id, p: {
        customer_id: event.customer_id, name: d.name.trim(), event_type: d.type, event_date: d.date, start_time: d.start || '', end_time: d.end || '',
        venue: d.venue.trim(), venue_address: d.venueAddress.trim(), guest_count: Number(d.guests || 0), description: d.description.trim(),
        special_instructions: d.instructions.trim(), services, deposit_required: toNum(d.deposit), payment_due_date: d.due || '', ...adjNumbers(adj),
        items: rows.filter((r) => r.service.trim()).map((r) => ({ service: r.service.trim(), description: r.description.trim(), quantity: toNum(r.quantity), unit_price: toNum(r.unit_price) })),
      } });
      if (error) throw error;
      if (d.allowOver !== event.allow_overpayment) {
        const r = await sb.from('events').update({ allow_overpayment: d.allowOver }).eq('id', event.id);
        if (r.error) throw r.error;
      }
      onSaved(); onClose();
    } catch (e) { setErr(friendlyError(e, 'Unable to save your changes.')); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit booking">
      <div className="space-y-4">
        <TextField label="Event name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <SelectField label="Event type" value={d.type} onChange={(e) => setD({ ...d, type: e.target.value })}>{types.map((t) => <option key={t}>{t}</option>)}</SelectField>
        <TextField label="Event date" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Start" type="time" value={d.start} onChange={(e) => setD({ ...d, start: e.target.value })} />
          <TextField label="End" type="time" value={d.end} onChange={(e) => setD({ ...d, end: e.target.value })} />
        </div>
        <TextField label="Venue" value={d.venue} onChange={(e) => setD({ ...d, venue: e.target.value })} />
        <TextField label="Venue address" value={d.venueAddress} onChange={(e) => setD({ ...d, venueAddress: e.target.value })} />
        <TextField label="Guests" inputMode="numeric" value={d.guests} onChange={(e) => setD({ ...d, guests: e.target.value })} />
        <TextArea label="Description" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
        <TextArea label="Special instructions" value={d.instructions} onChange={(e) => setD({ ...d, instructions: e.target.value })} />
        <fieldset><legend className="mb-2 text-sm font-semibold text-charcoal-400">Services</legend>
          <div className="flex flex-wrap gap-2">{Array.from(new Set([...SERVICE_OPTIONS, ...services])).map((s) => { const on = services.includes(s); return (
            <button key={s} type="button" aria-pressed={on} onClick={() => setServices(on ? services.filter((x) => x !== s) : [...services, s])}
              className={cx('min-h-[44px] rounded-full border px-4 text-sm font-semibold', on ? 'border-emerald bg-emerald-50 text-emerald-700' : 'border-charcoal-100 bg-white')}>{on ? '✓ ' : ''}{s}</button>); })}</div>
        </fieldset>
        <ItemsEditor items={rows} onChange={setRows} />
        <AdjustmentsEditor adj={adj} onChange={setAdj} items={rows} />
        <TextField label="Deposit required (₦)" inputMode="decimal" value={d.deposit} onChange={(e) => setD({ ...d, deposit: e.target.value })} />
        <TextField label="Payment deadline" type="date" value={d.due} onChange={(e) => setD({ ...d, due: e.target.value })} />
        <Toggle label="Allow overpayment on this booking" checked={d.allowOver} onChange={(v) => setD({ ...d, allowOver: v })} />
        {err && <ErrorBox message={err} />}
        <div className="flex gap-3"><Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" loading={busy} loadingText="Saving..." onClick={save}>Save changes</Button></div>
      </div>
    </Modal>
  );
}

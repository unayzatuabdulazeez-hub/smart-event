'use client';
import { useState } from 'react';
import { Lock, Plus } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { formatShort, todayStr } from '@/lib/dates';
import { formatNaira } from '@/lib/money';
import { VENDOR_STATUSES, VENDOR_TYPES, vendorStatusLabel } from '@/lib/status';
import { Badge, Button, Card, EmptyState, ErrorBox, Modal, SectionTitle, SelectField, TextField, statusTone } from '../ui';
import { toNum } from '../ItemsEditor';

export interface EventVendor {
  id: string; vendor_id: string; price: number; status: string; due_date: string | null; notes: string | null;
  vendors: { name: string; service: string; phone: string | null; whatsapp: string | null } | null;
  vendor_payments: { id: string; amount: number; paid_on: string; note: string | null }[];
}
export interface VendorLite { id: string; name: string; service: string }

export default function VendorsPanel({ businessId, eventId, rows, allVendors, onChanged, toast }: {
  businessId: string; eventId: string; rows: EventVendor[]; allVendors: VendorLite[]; onChanged: () => void; toast: { ok: (s: string) => void; err: (s: string) => void };
}) {
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<EventVendor | null>(null);
  const [f, setF] = useState({ vendorId: '', newName: '', newService: 'Decorator', newPhone: '', price: '', due: '' });
  const [pay, setPay] = useState({ amount: '', date: todayStr(), note: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sb = supabaseBrowser();

  async function add() {
    if (!f.vendorId && !f.newName.trim()) { setErr('Choose a vendor or type a new vendor’s name.'); return; }
    if (f.price !== '' && (Number.isNaN(Number(f.price.replace(/,/g, ''))) || toNum(f.price) < 0)) { setErr('Enter a valid price.'); return; }
    setBusy(true); setErr(null);
    try {
      let vendorId = f.vendorId;
      if (!vendorId) {
        const v = await sb.from('vendors').insert({ business_id: businessId, name: f.newName.trim(), service: f.newService, phone: f.newPhone.trim() || null, whatsapp: f.newPhone.trim() || null }).select('id').single();
        if (v.error) throw v.error; vendorId = v.data.id as string;
      }
      const { error } = await sb.from('event_vendors').insert({ business_id: businessId, event_id: eventId, vendor_id: vendorId, price: toNum(f.price), due_date: f.due || null });
      if (error) throw error;
      setAdding(false); setF({ vendorId: '', newName: '', newService: 'Decorator', newPhone: '', price: '', due: '' }); toast.ok('Vendor added'); onChanged();
    } catch (e) { setErr(friendlyError(e, 'Unable to add the vendor.')); } finally { setBusy(false); }
  }
  async function setStatus(r: EventVendor, status: string) {
    const { error } = await sb.from('event_vendors').update({ status }).eq('id', r.id);
    if (error) toast.err(friendlyError(error, 'Unable to update the vendor.')); else onChanged();
  }
  async function remove(r: EventVendor) {
    const { error } = await sb.from('event_vendors').delete().eq('id', r.id);
    if (error) toast.err(friendlyError(error, 'Unable to remove the vendor.')); else onChanged();
  }
  async function savePay() {
    if (!paying) return;
    const amount = toNum(pay.amount);
    const paid = paying.vendor_payments.reduce((s, p) => s + Number(p.amount), 0);
    if (!(amount > 0)) { setErr('Enter an amount greater than zero.'); return; }
    if (amount > Number(paying.price) - paid + 0.005) { setErr('That is more than the remaining vendor balance.'); return; }
    setBusy(true); setErr(null);
    const { error } = await sb.from('vendor_payments').insert({ business_id: businessId, event_vendor_id: paying.id, amount, paid_on: pay.date, note: pay.note.trim() || null });
    if (!error && paying.status === 'confirmed') await sb.from('event_vendors').update({ status: 'deposit_paid' }).eq('id', paying.id);
    setBusy(false);
    if (error) { setErr(friendlyError(error, 'Payment could not be recorded.')); return; }
    setPaying(null); setPay({ amount: '', date: todayStr(), note: '' }); toast.ok('Vendor payment recorded'); onChanged();
  }

  return (
    <section id="vendors">
      <SectionTitle action={<Button size="sm" variant="secondary" onClick={() => { setErr(null); setAdding(true); }}><Plus className="h-4 w-4" /> Add vendor</Button>}>Vendors</SectionTitle>
      <p className="mb-3 flex items-center gap-1.5 text-xs text-charcoal-300"><Lock className="h-3.5 w-3.5" /> Private. Customers never see vendor costs.</p>
      {rows.length === 0 ? <EmptyState emoji="🧑🏽‍🍳" title="No vendors added to this event" body="Add a decorator, photographer, DJ or anyone you are paying for this event." /> : (
        <div className="space-y-3">
          {rows.map((r) => {
            const paid = r.vendor_payments.reduce((s, p) => s + Number(p.amount), 0);
            const bal = Number(r.price) - paid;
            return (
              <Card key={r.id} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div><p className="font-semibold">{r.vendors?.name}</p><p className="text-xs text-charcoal-300">{r.vendors?.service}{r.due_date ? ` · pay by ${formatShort(r.due_date)}` : ''}</p></div>
                  <Badge tone={statusTone(r.status)}>{vendorStatusLabel(r.status)}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-xs text-charcoal-300">Price</p><p className="font-semibold">{formatNaira(r.price)}</p></div>
                  <div><p className="text-xs text-charcoal-300">Paid</p><p className="font-semibold text-emerald">{formatNaira(paid)}</p></div>
                  <div><p className="text-xs text-charcoal-300">Balance</p><p className="font-semibold text-coral-600">{formatNaira(bal)}</p></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select aria-label={`Status of ${r.vendors?.name}`} value={r.status} onChange={(e) => setStatus(r, e.target.value)} className="min-h-[44px] rounded-xl border border-charcoal-100 bg-white px-3 text-sm">
                    {VENDOR_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <Button size="sm" variant="gold" disabled={bal <= 0} onClick={() => { setErr(null); setPay({ amount: String(bal), date: todayStr(), note: '' }); setPaying(r); }}>Record payment</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r)}>Remove</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title="Add vendor to this event">
        <div className="space-y-4">
          <SelectField label="Existing vendor" value={f.vendorId} onChange={(e) => setF({ ...f, vendorId: e.target.value })}>
            <option value="">Choose…</option>{allVendors.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.service})</option>)}
          </SelectField>
          {!f.vendorId && (<>
            <p className="text-center text-xs text-charcoal-300">or add a new one</p>
            <TextField label="Vendor name" value={f.newName} onChange={(e) => setF({ ...f, newName: e.target.value })} />
            <SelectField label="Service" value={f.newService} onChange={(e) => setF({ ...f, newService: e.target.value })}>{VENDOR_TYPES.map((t) => <option key={t}>{t}</option>)}</SelectField>
            <TextField label="Phone / WhatsApp" inputMode="tel" value={f.newPhone} onChange={(e) => setF({ ...f, newPhone: e.target.value })} />
          </>)}
          <TextField label="Agreed price (₦)" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
          <TextField label="Payment due date" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
          {err && <ErrorBox message={err} />}
          <Button className="w-full" loading={busy} loadingText="Saving..." onClick={add}>Add vendor</Button>
        </div>
      </Modal>
      <Modal open={!!paying} onClose={() => setPaying(null)} title={`Pay ${paying?.vendors?.name ?? 'vendor'}`}>
        <div className="space-y-4">
          <TextField label="Amount (₦)" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
          <TextField label="Date" type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} />
          <TextField label="Note (optional)" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
          {err && <ErrorBox message={err} />}
          <Button className="w-full" loading={busy} loadingText="Saving..." onClick={savePay}>Save payment</Button>
        </div>
      </Modal>
    </section>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { formatShort, todayStr } from '@/lib/dates';
import { formatNaira, validatePayment } from '@/lib/money';
import { PAYMENT_LABEL } from '@/lib/status';
import type { EventRow, Financials, Payment } from '@/lib/types';
import { Badge, Button, Card, ErrorBox, Modal, SectionTitle, SelectField, Stat, TextField, statusTone } from '../ui';
import { toNum } from '../ItemsEditor';

export default function PaymentsPanel({ event, fin, payments, autoOpen, onChanged, toast }: {
  event: EventRow; fin: Financials; payments: Payment[]; autoOpen?: boolean; onChanged: () => void; toast: { ok: (s: string) => void; err: (s: string) => void };
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ amount: '', method: 'bank_transfer', date: todayStr(), reference: '', note: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (autoOpen && fin.balance > 0) setOpen(true); }, [autoOpen, fin.balance]);
  const balance = Number(fin.balance), total = Number(fin.total), paid = Number(fin.paid);

  async function save() {
    const amount = toNum(f.amount);
    const v = validatePayment(amount, balance, event.allow_overpayment);
    if (v) { setErr(v); return; }
    if (!f.date) { setErr('Choose the payment date.'); return; }
    setBusy(true); setErr(null);
    try {
      const sb = supabaseBrowser();
      const { error } = await sb.from('payments').insert({
        business_id: event.business_id, event_id: event.id, amount, paid_on: f.date, method: f.method,
        reference: f.reference.trim() || null, note: f.note.trim() || null,
      });
      if (error) throw error;
      // Keep the booking in step with the money (best-effort; payment itself is already safe).
      const nowPaid = paid + amount;
      const patch: Record<string, string> = {};
      if (['inquiry', 'quote_sent', 'awaiting_approval', 'confirmed'].includes(event.status)) patch.status = 'deposit_paid';
      if (Object.keys(patch).length) await sb.from('events').update(patch).eq('id', event.id);
      await sb.from('checklist_items').update({ done: true }).eq('event_id', event.id).eq('label', 'Deposit received');
      if (nowPaid >= total) await sb.from('checklist_items').update({ done: true }).eq('event_id', event.id).eq('label', 'Final payment received');
      setOpen(false); setF({ amount: '', method: 'bank_transfer', date: todayStr(), reference: '', note: '' });
      toast.ok('Payment recorded'); onChanged();
    } catch (e) { setErr(friendlyError(e, 'Payment could not be recorded.')); }
    finally { setBusy(false); }
  }

  return (
    <section id="payments">
      <SectionTitle action={<Button size="sm" variant="gold" onClick={() => { setErr(null); setF((p) => ({ ...p, amount: balance > 0 ? String(balance) : '' })); setOpen(true); }} disabled={balance <= 0 && !event.allow_overpayment}><HandCoins className="h-4 w-4" /> Record payment</Button>}>Payments</SectionTitle>
      <Card>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total" value={formatNaira(total)} />
          <Stat label="Paid" value={formatNaira(paid)} tone="good" />
          <Stat label="Balance" value={formatNaira(balance)} tone={balance > 0 ? 'bad' : 'good'} />
        </div>
        <div className="mt-3 flex items-center gap-2"><Badge tone={statusTone(fin.payment_status)}>{PAYMENT_LABEL[fin.payment_status]}</Badge>
          {event.payment_due_date && balance > 0 && <span className="text-xs text-charcoal-300">Due {formatShort(event.payment_due_date)}</span>}</div>
        {total > 0 && <div className="mt-3 h-2 overflow-hidden rounded-full bg-cream-300" role="img" aria-label={`${Math.min(100, Math.round((paid / total) * 100))}% paid`}><div className="h-full bg-emerald" style={{ width: `${Math.min(100, (paid / total) * 100)}%` }} /></div>}
        <div className="mt-4 divide-y divide-cream-200">
          {payments.length === 0 ? <p className="py-2 text-sm text-charcoal-300">No payments recorded yet.</p> : payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-3 text-sm">
              <div><p className="font-semibold">{formatNaira(p.amount)}</p><p className="text-xs text-charcoal-300">{formatShort(p.paid_on)} · {p.method.replace('_', ' ')}{p.reference ? ` · ${p.reference}` : ''}{p.note ? ` · ${p.note}` : ''}</p></div>
            </div>
          ))}
        </div>
        {payments.length > 0 && <p className="mt-2 text-xs text-charcoal-300">Payment history is permanent. To fix a mistake, record a note on the payment or contact support.</p>}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Record payment">
        <div className="space-y-4">
          <p className="rounded-xl bg-cream-100 p-3 text-sm">Remaining balance: <strong>{formatNaira(balance)}</strong></p>
          <TextField label="Amount (₦)" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <SelectField label="Method" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="pos">POS</option><option value="other">Other</option>
          </SelectField>
          <TextField label="Date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          <TextField label="Reference (optional)" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
          <TextField label="Note (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          {err && <ErrorBox message={err} />}
          <Button className="w-full" loading={busy} loadingText="Saving..." onClick={save}>Save payment</Button>
        </div>
      </Modal>
    </section>
  );
}

'use client';
import { formatNaira, grandTotal, subtotal } from '@/lib/money';
import { TextField } from './ui';
import { itemsToNumbers, toNum, type ItemDraft } from './ItemsEditor';

export interface AdjDraft { discount: string; additional_charges: string; delivery_fee: string; service_fee: string }
export const emptyAdj = (): AdjDraft => ({ discount: '', additional_charges: '', delivery_fee: '', service_fee: '' });
export const adjNumbers = (a: AdjDraft) => ({ discount: toNum(a.discount), additional_charges: toNum(a.additional_charges), delivery_fee: toNum(a.delivery_fee), service_fee: toNum(a.service_fee) });
export function adjError(a: AdjDraft): string | null {
  for (const v of Object.values(a)) if (v !== '' && (Number.isNaN(Number(v.replace(/,/g, ''))) || toNum(v) < 0)) return 'Discounts and charges must be valid, non-negative amounts.';
  return null;
}

export default function AdjustmentsEditor({ adj, onChange, items }: { adj: AdjDraft; onChange: (a: AdjDraft) => void; items: ItemDraft[] }) {
  const nums = itemsToNumbers(items);
  const sub = subtotal(nums);
  const a = adjNumbers(adj);
  const total = grandTotal(nums, a);
  const set = (k: keyof AdjDraft, v: string) => onChange({ ...adj, [k]: v });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Discount (₦)" inputMode="decimal" value={adj.discount} onChange={(e) => set('discount', e.target.value)} />
        <TextField label="Additional charges (₦)" inputMode="decimal" value={adj.additional_charges} onChange={(e) => set('additional_charges', e.target.value)} />
        <TextField label="Delivery fee (₦)" inputMode="decimal" value={adj.delivery_fee} onChange={(e) => set('delivery_fee', e.target.value)} />
        <TextField label="Service fee (₦)" inputMode="decimal" value={adj.service_fee} onChange={(e) => set('service_fee', e.target.value)} />
      </div>
      <dl className="space-y-1 rounded-2xl bg-cream-100 p-4 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatNaira(sub)}</dd></div>
        {a.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>-{formatNaira(a.discount)}</dd></div>}
        {a.additional_charges + a.delivery_fee + a.service_fee > 0 && <div className="flex justify-between"><dt>Additional charges</dt><dd>{formatNaira(a.additional_charges + a.delivery_fee + a.service_fee)}</dd></div>}
        <div className="flex justify-between border-t border-charcoal-100 pt-2 font-display text-xl"><dt>Grand total</dt><dd>{formatNaira(total)}</dd></div>
      </dl>
    </div>
  );
}

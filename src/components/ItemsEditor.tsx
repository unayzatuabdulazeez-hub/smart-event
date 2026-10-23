'use client';
import { Plus, Trash2 } from 'lucide-react';
import { formatNaira } from '@/lib/money';
import { SERVICE_OPTIONS } from '@/lib/status';
import { Button, inputCls } from './ui';

export interface ItemDraft { service: string; description: string; quantity: string; unit_price: string }
export const emptyItem = (service = ''): ItemDraft => ({ service, description: '', quantity: '1', unit_price: '' });
export const toNum = (s: string) => { const n = Number(String(s).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
export const itemsToNumbers = (items: ItemDraft[]) => items.map((i) => ({ quantity: toNum(i.quantity), unit_price: toNum(i.unit_price) }));
export function itemErrors(items: ItemDraft[]): string | null {
  const used = items.filter((i) => i.service.trim() || i.unit_price);
  if (used.length === 0) return 'Add at least one service with a price.';
  for (const i of used) {
    if (!i.service.trim()) return 'Every line needs a service name.';
    if (!(toNum(i.quantity) > 0)) return `Quantity for “${i.service}” must be more than zero.`;
    if (i.unit_price === '' || toNum(i.unit_price) < 0 || Number.isNaN(Number(i.unit_price.replace(/,/g, '')))) return `Enter a valid price for “${i.service}”.`;
  }
  return null;
}

export default function ItemsEditor({ items, onChange, suggestions = SERVICE_OPTIONS }: { items: ItemDraft[]; onChange: (i: ItemDraft[]) => void; suggestions?: string[] }) {
  const upd = (idx: number, patch: Partial<ItemDraft>) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const listId = 'service-suggestions';
  return (
    <div className="space-y-3">
      <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      {items.map((it, idx) => {
        const line = toNum(it.quantity) * toNum(it.unit_price);
        return (
          <div key={idx} className="space-y-2 rounded-2xl border border-charcoal-100 bg-white p-3">
            <div className="flex gap-2">
              <input list={listId} aria-label={`Service ${idx + 1}`} placeholder="Service e.g. Premium Catering" value={it.service} onChange={(e) => upd(idx, { service: e.target.value })} className={inputCls} />
              <button type="button" aria-label={`Remove line ${idx + 1}`} onClick={() => onChange(items.length > 1 ? items.filter((_, i) => i !== idx) : [emptyItem()])}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-coral-600 hover:bg-coral-50"><Trash2 className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-charcoal-300">Quantity
                <input inputMode="decimal" value={it.quantity} onChange={(e) => upd(idx, { quantity: e.target.value })} className={inputCls + ' mt-1'} /></label>
              <label className="text-xs font-semibold text-charcoal-300">Unit price (₦)
                <input inputMode="decimal" value={it.unit_price} onChange={(e) => upd(idx, { unit_price: e.target.value })} className={inputCls + ' mt-1'} placeholder="0" /></label>
            </div>
            <input aria-label={`Details for line ${idx + 1}`} placeholder="Details (optional)" value={it.description} onChange={(e) => upd(idx, { description: e.target.value })} className={inputCls} />
            <p className="text-right text-sm font-semibold">Line total: {formatNaira(line)}</p>
          </div>
        );
      })}
      <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...items, emptyItem()])}><Plus className="h-4 w-4" /> Add another service</Button>
    </div>
  );
}

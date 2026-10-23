import { supabaseBrowser } from './supabase/client';
import { must } from './useQuery';
import type { Financials } from './types';
import type { EventListItem } from '@/components/EventCard';

/** Events joined with customer name and calculated money. Capped for speed; paginate in the UI. */
export async function loadEventList(opts: { businessId: string; from?: string; to?: string; limit?: number; customerId?: string; ascending?: boolean }): Promise<EventListItem[]> {
  const sb = supabaseBrowser();
  let q = sb.from('events').select('id,name,event_date,guest_count,status,event_type,booking_number,customer_id,customers(name)')
    .eq('business_id', opts.businessId).order('event_date', { ascending: opts.ascending ?? true }).limit(opts.limit ?? 100);
  if (opts.from) q = q.gte('event_date', opts.from);
  if (opts.to) q = q.lte('event_date', opts.to);
  if (opts.customerId) q = q.eq('customer_id', opts.customerId);
  const rows = must(await q) as any[];
  if (!rows.length) return [];
  const fin = must(await sb.from('event_financials').select('*').in('event_id', rows.map((r) => r.id))) as Financials[];
  const byId = new Map(fin.map((f) => [f.event_id, f]));
  return rows.map((r) => {
    const f = byId.get(r.id);
    return {
      id: r.id, name: r.name, event_date: r.event_date, guest_count: r.guest_count, status: r.status, event_type: r.event_type,
      booking_number: r.booking_number, customer_name: r.customers?.name,
      total: Number(f?.total ?? 0), balance: Number(f?.balance ?? 0), payment_status: f?.payment_status ?? 'awaiting_payment',
    };
  });
}

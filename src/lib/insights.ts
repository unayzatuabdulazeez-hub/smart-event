import { supabaseBrowser } from './supabase/client';
import { must } from './useQuery';
import { profit } from './money';
import { addDaysStr, todayStr } from './dates';

export type Period = 'month' | '90d' | 'year' | 'all';
export const PERIODS: [Period, string][] = [['month', 'This month'], ['90d', 'Last 90 days'], ['year', 'This year'], ['all', 'All time']];

export function periodRange(p: Period, today = todayStr()): [string | null, string | null] {
  if (p === 'all') return [null, null];
  if (p === 'month') return [today.slice(0, 8) + '01', null];
  if (p === 'year') return [today.slice(0, 5) + '01-01', null];
  return [addDaysStr(today, -90), null];
}

/** All figures are computed from real records. Balance and profit are never stored. */
export async function loadInsights(businessId: string, period: Period) {
  const sb = supabaseBrowser();
  const [from] = periodRange(period);
  let q = sb.from('events').select('id,customer_id,status,event_date').eq('business_id', businessId).neq('status', 'cancelled').limit(2000);
  if (from) q = q.gte('event_date', from);
  const events = must(await q) as any[];
  const ids = events.map((e) => e.id);
  const today = todayStr();

  const [fin, exps, vend, items, allEv, custs] = await Promise.all([
    ids.length ? sb.from('event_financials').select('event_id,total,paid,balance').in('event_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? sb.from('event_expenses').select('amount').in('event_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? sb.from('event_vendors').select('price,status').in('event_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? sb.from('booking_items').select('service,event_id').in('event_id', ids) : Promise.resolve({ data: [], error: null }),
    sb.from('events').select('customer_id').eq('business_id', businessId).neq('status', 'cancelled').limit(5000),
    from ? sb.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', businessId).gte('created_at', from) : sb.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
  ]);
  const F = must(fin as any) as any[];
  const revenueBooked = F.reduce((s, r) => s + Number(r.total), 0);
  const collected = F.reduce((s, r) => s + Number(r.paid), 0);
  const outstanding = F.filter((r) => Number(r.balance) > 0).reduce((s, r) => s + Number(r.balance), 0);
  const costs = (must(exps as any) as any[]).reduce((s, r) => s + Number(r.amount), 0)
    + (must(vend as any) as any[]).filter((v) => v.status !== 'cancelled').reduce((s, v) => s + Number(v.price), 0);
  const p = profit(revenueBooked, costs);

  const perCustomer = new Map<string, number>();
  (must(allEv as any) as any[]).forEach((e) => perCustomer.set(e.customer_id, (perCustomer.get(e.customer_id) ?? 0) + 1));
  const inPeriodCustomers = new Set(events.map((e) => e.customer_id));
  const returning = Array.from(inPeriodCustomers).filter((c) => (perCustomer.get(c) ?? 0) > 1).length;

  const svc = new Map<string, Set<string>>();
  (must(items as any) as any[]).forEach((i) => { const k = String(i.service).trim(); if (!svc.has(k)) svc.set(k, new Set()); svc.get(k)!.add(i.event_id); });
  const popular = Array.from(svc.entries()).map(([name, s]) => ({ name, count: s.size })).sort((a, b) => b.count - a.count).slice(0, 5);

  const completed = events.filter((e) => e.status === 'completed').length;
  const active = events.filter((e) => !['completed', 'cancelled'].includes(e.status)).length;
  return {
    active, completed, upcoming: events.filter((e) => e.event_date >= today && !['completed'].includes(e.status)).length,
    bookedValue: revenueBooked, collected, outstanding, estimatedProfit: p.profit, margin: p.margin,
    newCustomers: (custs as any).count ?? 0, returning,
    averageBooking: events.length ? Math.round(revenueBooked / events.length) : 0, popular, bookings: events.length,
  };
}

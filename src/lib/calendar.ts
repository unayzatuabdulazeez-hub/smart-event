import { supabaseBrowser } from './supabase/client';
import { must } from './useQuery';

export type CalKind = 'event' | 'payment' | 'vendor' | 'appointment' | 'details' | 'task';
export interface CalItem { id: string; date: string; kind: CalKind; title: string; sub?: string; href: string; time?: string }

export const KIND_LABEL: Record<CalKind, string> = { event: 'Event', payment: 'Payment due', vendor: 'Vendor payment', appointment: 'Appointment', details: 'Final details due', task: 'Task' };
export const KIND_ICON: Record<CalKind, string> = { event: '🎉', payment: '💰', vendor: '🧾', appointment: '📅', details: '📝', task: '✅' };

/** All dated things in [from, to] (yyyy-mm-dd, inclusive). One query per source, each limited to the window. */
export async function loadCalendar(businessId: string, from: string, to: string): Promise<CalItem[]> {
  const sb = supabaseBrowser();
  const [ev, pay, ven, apt, det, tsk] = await Promise.all([
    sb.from('events').select('id,name,event_date,start_time,status,customers(name)').eq('business_id', businessId).gte('event_date', from).lte('event_date', to).neq('status', 'cancelled'),
    sb.from('events').select('id,name,payment_due_date,status').eq('business_id', businessId).gte('payment_due_date', from).lte('payment_due_date', to).not('status', 'in', '(cancelled,completed)'),
    sb.from('event_vendors').select('id,event_id,due_date,status,vendors(name),events(name)').eq('business_id', businessId).gte('due_date', from).lte('due_date', to).not('status', 'in', '(completed,cancelled)'),
    sb.from('appointments').select('id,event_id,title,starts_at,location').eq('business_id', businessId).gte('starts_at', from + 'T00:00:00+01:00').lte('starts_at', to + 'T23:59:59+01:00'),
    sb.from('events').select('id,name,next_step,next_step_due,status').eq('business_id', businessId).gte('next_step_due', from).lte('next_step_due', to).not('status', 'in', '(cancelled,completed)'),
    sb.from('tasks').select('id,event_id,title,due_date').eq('business_id', businessId).neq('status', 'done').gte('due_date', from).lte('due_date', to),
  ]);
  const out: CalItem[] = [];
  for (const e of must(ev) as any[]) out.push({ id: 'e' + e.id, date: e.event_date, kind: 'event', title: e.name, sub: e.customers?.name, href: `/app/events/${e.id}`, time: e.start_time?.slice(0, 5) });
  for (const e of must(pay) as any[]) out.push({ id: 'p' + e.id, date: e.payment_due_date, kind: 'payment', title: `Payment due: ${e.name}`, href: `/app/events/${e.id}#payments` });
  for (const v of must(ven) as any[]) out.push({ id: 'v' + v.id, date: v.due_date, kind: 'vendor', title: `Pay ${v.vendors?.name ?? 'vendor'}`, sub: v.events?.name, href: `/app/events/${v.event_id}#vendors` });
  for (const a of must(apt) as any[]) {
    const d = new Date(a.starts_at);
    const lagos = new Date(d.getTime() + 60 * 60000); // Africa/Lagos is UTC+1, no DST
    out.push({ id: 'a' + a.id, date: lagos.toISOString().slice(0, 10), kind: 'appointment', title: a.title, sub: a.location ?? undefined, time: lagos.toISOString().slice(11, 16), href: a.event_id ? `/app/events/${a.event_id}` : '/app/calendar' });
  }
  for (const e of must(det) as any[]) out.push({ id: 'd' + e.id, date: e.next_step_due, kind: 'details', title: e.next_step || 'Final details', sub: e.name, href: `/app/events/${e.id}` });
  for (const t of must(tsk) as any[]) out.push({ id: 't' + t.id, date: t.due_date, kind: 'task', title: t.title, href: t.event_id ? `/app/events/${t.event_id}#tasks` : '/app/tasks' });
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '99').localeCompare(b.time ?? '99'));
}

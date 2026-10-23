import { supabaseBrowser } from './supabase/client';
import { must } from './useQuery';

/** Strip characters that have meaning inside a PostgREST or()/ilike filter. */
export const safeTerm = (q: string) => q.replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

export async function globalSearch(businessId: string, raw: string) {
  const q = safeTerm(raw);
  if (q.length < 2) return { customers: [], events: [] };
  const sb = supabaseBrowser();
  const like = `%${q}%`;
  const digits = q.replace(/\D/g, '');
  const phoneLike = digits.length >= 3 ? `%${digits.replace(/^0/, '')}%` : null;
  const custOr = [`name.ilike.${like}`, phoneLike ? `phone.ilike.${phoneLike}` : null, phoneLike ? `whatsapp.ilike.${phoneLike}` : null].filter(Boolean).join(',');

  const [custRes, evRes, itemRes] = await Promise.all([
    sb.from('customers').select('id,name,phone,whatsapp').eq('business_id', businessId).or(custOr).limit(15),
    sb.from('events').select('id,name,event_date,venue,status,booking_number,customers(name)').eq('business_id', businessId)
      .or(`name.ilike.${like},venue.ilike.${like},booking_number.ilike.${like},event_type.ilike.${like}`).limit(15),
    sb.from('booking_items').select('event_id').eq('business_id', businessId).ilike('service', like).limit(30),
  ]);
  const customers = must(custRes) as any[];
  const events = must(evRes) as any[];
  const itemEventIds = Array.from(new Set((must(itemRes) as any[]).map((i) => i.event_id))).filter((id) => !events.some((e) => e.id === id));
  if (itemEventIds.length) {
    const extra = must(await sb.from('events').select('id,name,event_date,venue,status,booking_number,customers(name)').eq('business_id', businessId).in('id', itemEventIds.slice(0, 10))) as any[];
    events.push(...extra);
  }
  // Customers matched through an event's customer name are already covered by the customers query.
  return { customers, events };
}

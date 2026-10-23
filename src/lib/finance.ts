import { supabaseBrowser } from './supabase/client';
import type { Financials } from './types';

/** Fetch calculated financials for a set of events (balance is never stored). */
export async function fetchFinancials(eventIds: string[]): Promise<Record<string, Financials>> {
  if (!eventIds.length) return {};
  const { data, error } = await supabaseBrowser().from('event_financials').select('*').in('event_id', eventIds);
  if (error) throw error;
  const out: Record<string, Financials> = {};
  (data ?? []).forEach((r) => { out[r.event_id as string] = { ...(r as Financials), subtotal: Number(r.subtotal), total: Number(r.total), paid: Number(r.paid), balance: Number(r.balance) }; });
  return out;
}

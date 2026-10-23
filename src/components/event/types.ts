import type { Business, Customer, EventRow, Financials } from '@/lib/types';

export interface PanelProps {
  event: EventRow;
  business: Business;
  customer: Customer;
  fin: Financials;
  reload: () => void;
  toast: { ok: (t: string) => void; err: (t: string) => void };
}

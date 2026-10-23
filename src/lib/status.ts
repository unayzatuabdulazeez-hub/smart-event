export const EVENT_STATUSES = [
  { value: 'inquiry', label: 'Inquiry' },
  { value: 'quote_sent', label: 'Quote Sent' },
  { value: 'awaiting_approval', label: 'Awaiting Approval' },
  { value: 'confirmed', label: 'Booking Confirmed' },
  { value: 'deposit_paid', label: 'Deposit Paid' },
  { value: 'planning', label: 'Planning' },
  { value: 'final_details', label: 'Final Details Pending' },
  { value: 'ready', label: 'Ready for Event' },
  { value: 'event_day', label: 'Event Day' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number]['value'];
export const statusLabel = (s: string) => EVENT_STATUSES.find((x) => x.value === s)?.label ?? s;

export const VENDOR_STATUSES = [
  ['not_contacted', 'Not Contacted'], ['contacted', 'Contacted'], ['confirmed', 'Confirmed'],
  ['deposit_paid', 'Deposit Paid'], ['completed', 'Completed'], ['cancelled', 'Cancelled'],
] as const;
export const vendorStatusLabel = (s: string) => VENDOR_STATUSES.find((x) => x[0] === s)?.[1] ?? s;

export const PAYMENT_LABEL: Record<string, string> = {
  awaiting_payment: 'Awaiting Payment', partially_paid: 'Partially Paid', paid_in_full: 'Paid in Full',
};

export const EVENT_TYPES = ['Wedding', 'Birthday', 'Naming Ceremony', 'Graduation', 'Corporate Event', 'Dinner', 'Religious Event', 'Party', 'Other'];
export const SERVICE_OPTIONS = ['Catering', 'Small Chops', 'Decoration', 'Event Planning', 'Drinks', 'Dessert', 'Waiters', 'Equipment', 'Other'];
export const VENDOR_TYPES = ['Decorator', 'Photographer', 'MC', 'DJ', 'Makeup Artist', 'Venue', 'Security', 'Rental Company', 'Sound Company', 'Cake Vendor', 'Transport', 'Other'];
export const EXPENSE_CATEGORIES = ['Ingredients', 'Transport', 'Fuel/Gas', 'Labour', 'Packaging', 'Equipment', 'Other'];
export const BUSINESS_TYPES = [
  ['catering', 'Catering'], ['small_chops', 'Small Chops'], ['wedding_planning', 'Wedding Planning'],
  ['event_planning', 'Event Planning'], ['decoration', 'Decoration'], ['multiple', 'Multiple Services'], ['other', 'Other Event Service'],
] as const;

/** The customer-facing journey. Derived from status + payment + checklist, never hand-typed. */
export interface JourneyStep { key: string; label: string; state: 'done' | 'current' | 'todo' }
export function buildJourney(input: {
  status: string; depositReceived: boolean; menuConfirmed?: boolean; guestCountConfirmed?: boolean;
}): JourneyStep[] {
  const order = EVENT_STATUSES.map((s) => s.value as string);
  const idx = order.indexOf(input.status);
  const confirmed = idx >= order.indexOf('confirmed');
  const prep = idx >= order.indexOf('planning');
  const ready = idx >= order.indexOf('ready');
  const eventDay = idx >= order.indexOf('event_day');
  const completed = input.status === 'completed';
  const raw: { key: string; label: string; done: boolean }[] = [
    { key: 'confirmed', label: 'Booking confirmed', done: confirmed },
    { key: 'deposit', label: 'Deposit received', done: input.depositReceived },
    { key: 'menu', label: 'Menu confirmed', done: !!input.menuConfirmed },
    { key: 'guests', label: 'Guest count received', done: !!input.guestCountConfirmed },
    { key: 'prep', label: 'Final preparation', done: ready },
    { key: 'day', label: 'Event day', done: eventDay && prep },
    { key: 'completed', label: 'Completed', done: completed },
  ];
  let currentSet = false;
  return raw.map((s) => {
    if (s.done) return { key: s.key, label: s.label, state: 'done' as const };
    if (!currentSet) { currentSet = true; return { key: s.key, label: s.label, state: 'current' as const }; }
    return { key: s.key, label: s.label, state: 'todo' as const };
  });
}

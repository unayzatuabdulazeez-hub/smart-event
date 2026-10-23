'use client';
import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useBusiness } from '@/components/BusinessProvider';
import { useQuery } from '@/lib/useQuery';
import { loadEventList } from '@/lib/loaders';
import { daysUntil, todayStr } from '@/lib/dates';
import { Button, EmptyState, ErrorBox, ListSkeleton, PageHeader, cx } from '@/components/ui';
import EventCard, { type EventListItem } from '@/components/EventCard';

const FILTERS: { key: string; label: string; test: (e: EventListItem, today: string) => boolean }[] = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'upcoming', label: 'Upcoming', test: (e, t) => e.event_date >= t && !['cancelled', 'completed'].includes(e.status) },
  { key: 'today', label: 'Today', test: (e, t) => e.event_date === t && e.status !== 'cancelled' },
  { key: 'week', label: 'This Week', test: (e) => { const d = daysUntil(e.event_date); return d >= 0 && d <= 7 && !['cancelled', 'completed'].includes(e.status); } },
  { key: 'awaiting', label: 'Awaiting Approval', test: (e) => ['awaiting_approval', 'quote_sent'].includes(e.status) },
  { key: 'confirmed', label: 'Confirmed', test: (e) => ['confirmed', 'deposit_paid', 'planning', 'final_details', 'ready', 'event_day'].includes(e.status) },
  { key: 'payment_due', label: 'Payment Due', test: (e) => (e.balance ?? 0) > 0 && !['cancelled', 'inquiry'].includes(e.status) },
  { key: 'partial', label: 'Partially Paid', test: (e) => e.payment_status === 'partially_paid' && e.status !== 'cancelled' },
  { key: 'paid', label: 'Paid', test: (e) => e.payment_status === 'paid_in_full' && e.status !== 'cancelled' },
  { key: 'completed', label: 'Completed', test: (e) => e.status === 'completed' },
  { key: 'cancelled', label: 'Cancelled', test: (e) => e.status === 'cancelled' },
];
const PAGE = 20;

function EventsInner() {
  const { business } = useBusiness();
  const params = useSearchParams();
  const [filter, setFilter] = useState(FILTERS.some((f) => f.key === params.get('filter')) ? (params.get('filter') as string) : 'upcoming');
  const [page, setPage] = useState(0);
  const choosingPayment = params.get('pay') === '1';
  const today = todayStr();
  const { data, loading, error, reload } = useQuery(() => loadEventList({ businessId: business.id, limit: 300, ascending: false }), [business.id]);

  const rows = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    const list = (data ?? []).filter((e) => f.test(e, today));
    // Upcoming-style filters read best soonest-first; history reads newest-first.
    return ['upcoming', 'today', 'week', 'awaiting', 'confirmed', 'payment_due'].includes(filter)
      ? [...list].sort((a, b) => a.event_date.localeCompare(b.event_date)) : list;
  }, [data, filter, today]);

  return (
    <div className="space-y-5">
      <PageHeader title="Events" subtitle="Every booking in one place" action={<Link href="/app/events/new"><Button size="sm"><Plus className="h-4 w-4" /> New</Button></Link>} />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Filter events">
        {FILTERS.map((f) => (
          <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => { setFilter(f.key); setPage(0); }}
            className={cx('min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-semibold', filter === f.key ? 'border-burgundy bg-burgundy text-white' : 'border-charcoal-100 bg-white')}>{f.label}</button>
        ))}
      </div>
      {choosingPayment && <p role="status" className="rounded-2xl bg-gold-50 p-4 text-sm font-semibold text-gold-600">Choose the booking you received a payment for.</p>}
      {loading ? <ListSkeleton /> : error ? <ErrorBox message={error} onRetry={reload} /> : rows.length === 0 ? (
        <EmptyState title={filter === 'all' ? 'Your first event is waiting ❤️' : 'Nothing here yet'} body={filter === 'all' ? 'Create a booking to start tracking money, tasks and progress.' : 'No events match this filter.'}
          action={filter === 'all' ? <Link href="/app/events/new"><Button>+ New Booking</Button></Link> : undefined} />
      ) : (
        <>
          <div className="space-y-3">{rows.slice(page * PAGE, page * PAGE + PAGE).map((e) => <EventCard key={e.id} e={e} payMode={choosingPayment} />)}</div>
          {rows.length > PAGE && (
            <div className="flex items-center justify-between">
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-sm text-charcoal-300">Page {page + 1} of {Math.ceil(rows.length / PAGE)}</span>
              <Button variant="secondary" size="sm" disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
export default function Events() { return <Suspense><EventsInner /></Suspense>; }

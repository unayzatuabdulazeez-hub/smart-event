'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useBusiness } from '@/components/BusinessProvider';
import { useQuery } from '@/lib/useQuery';
import { globalSearch } from '@/lib/search';
import { formatShort } from '@/lib/dates';
import { statusLabel } from '@/lib/status';
import { Badge, EmptyState, ErrorBox, ListSkeleton, PageHeader, SectionTitle, statusTone } from '@/components/ui';
import SearchBar from '@/components/SearchBar';

function Results() {
  const q = useSearchParams().get('q') ?? '';
  const { business } = useBusiness();
  const { data, loading, error, reload } = useQuery(() => globalSearch(business.id, q), [q, business.id]);
  return (
    <div className="space-y-6">
      <PageHeader title="Search" />
      <SearchBar initial={q} />
      {loading ? <ListSkeleton rows={3} /> : error ? <ErrorBox message={error} onRetry={reload} /> : data && (
        data.customers.length + data.events.length === 0
          ? <EmptyState emoji="🔎" title="No matches" body="Try a name, a phone number, an event or a venue." />
          : <>
              {data.customers.length > 0 && <section><SectionTitle>Customers</SectionTitle><div className="space-y-2">
                {data.customers.map((c: any) => <Link key={c.id} href={`/app/customers/${c.id}`} className="block rounded-2xl bg-white p-4 shadow-card"><p className="font-semibold">{c.name}</p><p className="text-sm text-charcoal-300">{c.phone || c.whatsapp}</p></Link>)}
              </div></section>}
              {data.events.length > 0 && <section><SectionTitle>Events</SectionTitle><div className="space-y-2">
                {data.events.map((e: any) => (
                  <Link key={e.id} href={`/app/events/${e.id}`} className="block rounded-2xl bg-white p-4 shadow-card">
                    <div className="flex items-center justify-between gap-2"><p className="font-semibold">{e.name}</p><Badge tone={statusTone(e.status)}>{statusLabel(e.status)}</Badge></div>
                    <p className="text-sm text-charcoal-300">{e.customers?.name} · {formatShort(e.event_date)}{e.venue ? ` · ${e.venue}` : ''}{e.booking_number ? ` · ${e.booking_number}` : ''}</p>
                  </Link>))}
              </div></section>}
            </>
      )}
    </div>
  );
}
export default function SearchPage() { return <Suspense><Results /></Suspense>; }

'use client';
import { useState } from 'react';
import { useBusiness } from '@/components/BusinessProvider';
import { useQuery } from '@/lib/useQuery';
import { PERIODS, loadInsights, type Period } from '@/lib/insights';
import { formatNaira } from '@/lib/money';
import { Card, EmptyState, ErrorBox, ListSkeleton, PageHeader, Stat, cx } from '@/components/ui';

export default function Insights() {
  const { business } = useBusiness();
  const [period, setPeriod] = useState<Period>('90d');
  const { data, loading, error, reload } = useQuery(() => loadInsights(business.id, period), [business.id, period]);
  return (
    <div className="space-y-5">
      <PageHeader title="Insights" subtitle="A simple view of how your business is doing" />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Period">
        {PERIODS.map(([k, l]) => <button key={k} role="tab" aria-selected={period === k} onClick={() => setPeriod(k)} className={cx('min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-semibold', period === k ? 'border-burgundy bg-burgundy text-white' : 'border-charcoal-100 bg-white')}>{l}</button>)}
      </div>
      {loading ? <ListSkeleton /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data || data.bookings === 0
        ? <EmptyState emoji="📈" title="No bookings in this period" body="Once you have bookings, your numbers appear here." />
        : <>
            <div className="grid grid-cols-2 gap-3">
              <Card><Stat label="Active bookings" value={String(data.active)} /></Card>
              <Card><Stat label="Completed events" value={String(data.completed)} tone="good" /></Card>
              <Card><Stat label="Booked value" value={formatNaira(data.bookedValue)} /></Card>
              <Card><Stat label="Payments collected" value={formatNaira(data.collected)} tone="good" /></Card>
              <Card><Stat label="Outstanding" value={formatNaira(data.outstanding)} tone={data.outstanding > 0 ? 'bad' : undefined} /></Card>
              <Card><Stat label="Estimated profit" value={formatNaira(data.estimatedProfit)} tone={data.estimatedProfit < 0 ? 'bad' : 'good'} /></Card>
              <Card><Stat label="Average booking" value={formatNaira(data.averageBooking)} /></Card>
              <Card><Stat label="Upcoming events" value={String(data.upcoming)} /></Card>
              <Card><Stat label="New customers" value={String(data.newCustomers)} /></Card>
              <Card><Stat label="Returning customers" value={String(data.returning)} /></Card>
            </div>
            <p className="text-xs text-charcoal-300">Estimated profit = booked value minus recorded expenses and vendor prices for these events ({data.margin}% margin). It is only as complete as the costs you have recorded.</p>
            <Card>
              <h2 className="mb-3 font-display text-xl">Most popular services</h2>
              {data.popular.length === 0 ? <p className="text-sm text-charcoal-300">No services recorded yet.</p> : (
                <ol className="space-y-3">{data.popular.map((p, i) => (
                  <li key={p.name}><div className="flex justify-between text-sm"><span className="font-semibold">{i + 1}. {p.name}</span><span>{p.count} booking{p.count === 1 ? '' : 's'}</span></div>
                    <div className="mt-1 h-2 rounded-full bg-cream-300"><div className="h-2 rounded-full bg-burgundy" style={{ width: `${(p.count / data.popular[0].count) * 100}%` }} /></div></li>))}</ol>)}
            </Card>
          </>}
    </div>
  );
}

'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useBusiness } from '@/components/BusinessProvider';
import { useQuery } from '@/lib/useQuery';
import { KIND_ICON, KIND_LABEL, loadCalendar, type CalItem } from '@/lib/calendar';
import { addDaysStr, formatDate, formatTime, todayStr } from '@/lib/dates';
import { Button, EmptyState, ErrorBox, ListSkeleton, PageHeader, cx } from '@/components/ui';

type View = 'agenda' | 'week' | 'month';
const startOfWeek = (d: string) => { const [y, m, dd] = d.split('-').map(Number); const dow = (new Date(Date.UTC(y, m - 1, dd)).getUTCDay() + 6) % 7; return addDaysStr(d, -dow); };
const monthStart = (d: string) => d.slice(0, 8) + '01';
const addMonths = (d: string, n: number) => { const [y, m] = d.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1 + n, 1)); return dt.toISOString().slice(0, 10); };
const monthLen = (d: string) => { const [y, m] = d.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

function Row({ i }: { i: CalItem }) {
  return (
    <Link href={i.href} className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
      <span className="text-xl" aria-hidden>{KIND_ICON[i.kind]}</span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{i.title}</p><p className="truncate text-xs text-charcoal-300">{KIND_LABEL[i.kind]}{i.time ? ` · ${formatTime(i.time)}` : ''}{i.sub ? ` · ${i.sub}` : ''}</p></div>
    </Link>
  );
}

export default function CalendarPage() {
  const { business } = useBusiness();
  const today = todayStr();
  const [view, setView] = useState<View>('agenda');
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);

  const range = useMemo(() => {
    if (view === 'agenda') return [today, addDaysStr(today, 60)] as const;
    if (view === 'week') { const s = startOfWeek(anchor); return [s, addDaysStr(s, 6)] as const; }
    const s = monthStart(anchor); return [startOfWeek(s), addDaysStr(startOfWeek(s), 41)] as const;
  }, [view, anchor, today]);

  const { data, loading, error, reload } = useQuery(() => loadCalendar(business.id, range[0], range[1]), [business.id, range[0], range[1]]);
  const byDate = useMemo(() => { const m = new Map<string, CalItem[]>(); (data ?? []).forEach((i) => m.set(i.date, [...(m.get(i.date) ?? []), i])); return m; }, [data]);
  const step = (dir: number) => setAnchor(view === 'week' ? addDaysStr(anchor, 7 * dir) : addMonths(monthStart(anchor), dir));

  return (
    <div className="space-y-5">
      <PageHeader title="Calendar" subtitle="What is happening today and what is coming next" />
      <div className="flex gap-2" role="tablist" aria-label="Calendar view">
        {(['agenda', 'week', 'month'] as View[]).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cx('min-h-[44px] flex-1 rounded-full border text-sm font-semibold capitalize', view === v ? 'border-burgundy bg-burgundy text-white' : 'border-charcoal-100 bg-white')}>{v === 'agenda' ? 'Agenda' : v === 'week' ? 'Week' : 'Month'}</button>
        ))}
      </div>
      {view !== 'agenda' && (
        <div className="flex items-center justify-between">
          <Button variant="secondary" size="sm" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></Button>
          <p className="font-display text-xl">{view === 'month' ? formatDate(monthStart(anchor), { month: 'long', year: 'numeric' }) : `${formatDate(range[0], { day: 'numeric', month: 'short' })} to ${formatDate(range[1], { day: 'numeric', month: 'short' })}`}</p>
          <Button variant="secondary" size="sm" onClick={() => step(1)} aria-label="Next"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
      {loading && !data ? <ListSkeleton rows={4} /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <>
          {view === 'agenda' && ((data ?? []).length === 0
            ? <EmptyState emoji="☕" title="Your calendar is clear. Enjoy the breathing room." body="Events, deadlines and appointments for the next 60 days will appear here." />
            : <div className="space-y-5">{Array.from(byDate.entries()).map(([date, items]) => (
                <section key={date}><h2 className={cx('mb-2 text-sm font-bold uppercase tracking-wide', date === today ? 'text-burgundy' : 'text-charcoal-300')}>{date === today ? 'Today · ' : ''}{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
                  <div className="space-y-2">{items.map((i) => <Row key={i.id} i={i} />)}</div></section>))}</div>)}

          {view === 'week' && (
            <div className="space-y-4">{Array.from({ length: 7 }, (_, n) => addDaysStr(range[0], n)).map((date) => (
              <section key={date}><h2 className={cx('mb-2 text-sm font-bold uppercase tracking-wide', date === today ? 'text-burgundy' : 'text-charcoal-300')}>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}</h2>
                {(byDate.get(date) ?? []).length === 0 ? <p className="rounded-2xl border border-dashed border-charcoal-100 p-3 text-sm text-charcoal-200">Nothing planned</p>
                  : <div className="space-y-2">{byDate.get(date)!.map((i) => <Row key={i.id} i={i} />)}</div>}</section>))}</div>
          )}

          {view === 'month' && (
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-charcoal-300" aria-hidden>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}</div>
              <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Month">
                {Array.from({ length: 42 }, (_, n) => addDaysStr(range[0], n)).map((date) => {
                  const inMonth = date.slice(0, 7) === monthStart(anchor).slice(0, 7);
                  const items = byDate.get(date) ?? [];
                  return (
                    <button key={date} role="gridcell" aria-selected={selected === date} aria-label={`${formatDate(date)}, ${items.length} item${items.length === 1 ? '' : 's'}`} onClick={() => setSelected(date)}
                      className={cx('relative flex min-h-[52px] flex-col items-center rounded-xl border p-1 text-sm', selected === date ? 'border-burgundy bg-burgundy-50' : 'border-transparent bg-white', !inMonth && 'opacity-40', date === today && 'ring-2 ring-gold')}>
                      <span className="font-semibold">{Number(date.slice(8))}</span>
                      {items.length > 0 && <span className="mt-0.5 rounded-full bg-burgundy px-1.5 text-[10px] font-bold text-white">{items.length}</span>}
                    </button>);
                })}
              </div>
              <section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-charcoal-300">{formatDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
                {(byDate.get(selected) ?? []).length === 0 ? <p className="rounded-2xl border border-dashed border-charcoal-100 p-3 text-sm text-charcoal-200">Nothing planned for this day.</p>
                  : <div className="space-y-2">{byDate.get(selected)!.map((i) => <Row key={i.id} i={i} />)}</div>}</section>
            </>
          )}
        </>
      )}
    </div>
  );
}

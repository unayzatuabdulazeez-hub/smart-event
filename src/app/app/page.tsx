'use client';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, ClipboardCheck, FilePlus2, HandCoins, Receipt, UserPlus, Wallet } from 'lucide-react';
import { useBusiness } from '@/components/BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must, useQuery } from '@/lib/useQuery';
import { addDaysStr, daysUntil, formatShort, greeting, todayStr } from '@/lib/dates';
import { formatNaira } from '@/lib/money';
import { Badge, Button, Card, EmptyState, ErrorBox, ListSkeleton, SectionTitle, statusTone } from '@/components/ui';
import EventCard from '@/components/EventCard';
import { loadEventList } from '@/lib/loaders';
import SearchBar from '@/components/SearchBar';

interface Attention { key: string; text: string; href: string; tone: 'bad' | 'warn' | 'brand' }

export default function Home() {
  const { business, userName } = useBusiness();
  const sb = supabaseBrowser();
  const today = todayStr();

  const { data, loading, error, reload } = useQuery(async () => {
    const bid = business.id;
    const [upcoming, active, tasks, vendorDue, quotes, recentCustomers, followUps] = await Promise.all([
      loadEventList({ businessId: bid, from: today, limit: 30 }),
      loadEventList({ businessId: bid, from: addDaysStr(today, -60), limit: 200, ascending: false }),
      sb.from('tasks').select('id,title,due_date,priority,status,event_id').eq('business_id', bid).neq('status', 'done').order('due_date', { ascending: true, nullsFirst: false }).limit(8),
      sb.from('event_vendors').select('id,due_date,price,status,vendors(name)').eq('business_id', bid).not('status', 'in', '(completed,cancelled)').lte('due_date', addDaysStr(today, 3)).not('due_date', 'is', null).limit(10),
      sb.from('quotes').select('id,quote_number,title,status').eq('business_id', bid).eq('status', 'sent').limit(10),
      sb.from('customers').select('id,name,created_at').eq('business_id', bid).order('created_at', { ascending: false }).limit(4),
      sb.from('follow_ups').select('id,kind,due_date,events(name)').eq('business_id', bid).eq('done', false).lte('due_date', today).limit(5),
    ]);
    return {
      upcoming, active,
      tasks: must(tasks) as any[], vendorDue: must(vendorDue) as any[], quotes: must(quotes) as any[],
      recentCustomers: must(recentCustomers) as any[], followUps: must(followUps) as any[],
    };
  }, [business.id]);

  if (loading) return <ListSkeleton rows={5} />;
  if (error || !data) return <ErrorBox message={error ?? 'Something went wrong. Please try again.'} onRetry={reload} />;

  const open = data.active.filter((e) => !['cancelled', 'completed'].includes(e.status));
  const moneyToCollect = open.reduce((s, e) => s + Math.max(e.balance ?? 0, 0), 0);
  const overdue = data.active.filter((e) => !['cancelled'].includes(e.status) && (e.balance ?? 0) > 0 && e.status !== 'inquiry');
  const todays = data.upcoming.filter((e) => e.event_date === today && e.status !== 'cancelled');
  const thisWeek = data.upcoming.filter((e) => daysUntil(e.event_date) <= 7 && e.status !== 'cancelled' && e.status !== 'completed');
  const next = data.upcoming.filter((e) => !['cancelled', 'completed'].includes(e.status)).slice(0, 4);

  const attention: Attention[] = [];
  if (overdue.length) attention.push({ key: 'bal', text: `${overdue.length} booking${overdue.length > 1 ? 's' : ''} with money still to collect`, href: '/app/events?filter=payment_due', tone: 'bad' });
  if (data.quotes.length) attention.push({ key: 'q', text: `${data.quotes.length} quotation${data.quotes.length > 1 ? 's' : ''} awaiting approval`, href: '/app/quotes', tone: 'warn' });
  if (thisWeek.length) attention.push({ key: 'w', text: `${thisWeek.length} event${thisWeek.length > 1 ? 's' : ''} this week`, href: '/app/events?filter=week', tone: 'brand' });
  if (data.vendorDue.length) attention.push({ key: 'v', text: `${data.vendorDue.length} vendor payment${data.vendorDue.length > 1 ? 's' : ''} due soon`, href: '/app/vendors', tone: 'warn' });
  data.tasks.filter((t) => t.due_date && t.due_date <= addDaysStr(today, 3)).slice(0, 3)
    .forEach((t) => attention.push({ key: 't' + t.id, text: t.title, href: t.event_id ? `/app/events/${t.event_id}` : '/app/tasks', tone: t.due_date < today ? 'bad' : 'warn' }));
  data.followUps.forEach((f) => attention.push({ key: 'f' + f.id, text: `Follow up: ${f.events?.name ?? 'event'}`, href: '/app/follow-ups', tone: 'brand' }));

  const first = (userName || business.name).split(' ')[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">{greeting()}, {first} ❤️</h1>
        <p className="mt-1 text-charcoal-300">Here’s what needs your attention today.</p>
      </div>
      <SearchBar />

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-burgundy text-white border-burgundy">
          <Wallet className="h-5 w-5 opacity-80" />
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide opacity-80">Money to collect</p>
          <p className="font-display text-3xl">{formatNaira(moneyToCollect)}</p>
        </Card>
        <Card>
          <ClipboardCheck className="h-5 w-5 text-emerald" />
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-charcoal-300">Active bookings</p>
          <p className="font-display text-3xl">{open.length}</p>
        </Card>
      </div>

      <section>
        <SectionTitle>Needs your attention</SectionTitle>
        {attention.length === 0 ? (
          <EmptyState emoji="☕" title="Nothing urgent right now" body="Your calendar is clear. Enjoy the breathing room." />
        ) : (
          <div className="space-y-2">
            {attention.map((a) => (
              <Link key={a.key} href={a.href} className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-cream-300/60 bg-white px-4 shadow-card">
                <AlertTriangle className={`h-5 w-5 shrink-0 ${a.tone === 'bad' ? 'text-coral-600' : a.tone === 'warn' ? 'text-gold-600' : 'text-burgundy'}`} aria-hidden />
                <span className="text-sm font-semibold">{a.text}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Today</SectionTitle>
        {todays.length === 0
          ? <p className="rounded-2xl bg-white p-4 text-sm text-charcoal-300 shadow-card">Your calendar is clear today. Enjoy the breathing room ☕</p>
          : <div className="space-y-3">{todays.map((e) => <EventCard key={e.id} e={e} />)}</div>}
      </section>

      <section>
        <SectionTitle action={<Link href="/app/events" className="text-sm font-semibold text-burgundy">See all</Link>}>Upcoming events</SectionTitle>
        {next.length === 0
          ? <EmptyState title="Your first event is waiting ❤️" body="Create a booking and it will show up here." action={<Link href="/app/events/new"><Button>+ New Booking</Button></Link>} />
          : <div className="space-y-3">{next.map((e) => <EventCard key={e.id} e={e} />)}</div>}
      </section>

      <section>
        <SectionTitle>Quick actions</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { href: '/app/events/new', label: 'New Booking', icon: CalendarClock },
            { href: '/app/customers/new', label: 'Add Customer', icon: UserPlus },
            { href: '/app/quotes/new', label: 'Create Quote', icon: FilePlus2 },
            { href: '/app/events?filter=payment_due&pay=1', label: 'Record Payment', icon: HandCoins },
            { href: '/app/expenses?new=1', label: 'Add Expense', icon: Receipt },
          ].map((a) => (
            <Link key={a.label} href={a.href} className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border border-cream-300/60 bg-white p-3 text-center text-sm font-semibold shadow-card hover:border-burgundy/30">
              <a.icon className="h-6 w-6 text-burgundy" /> {a.label}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle action={<Link href="/app/customers" className="text-sm font-semibold text-burgundy">See all</Link>}>Recent customers</SectionTitle>
        {data.recentCustomers.length === 0
          ? <EmptyState emoji="🤝" title="No customers yet. Let’s add your first one." action={<Link href="/app/customers/new"><Button variant="secondary">Add Customer</Button></Link>} />
          : <div className="flex flex-wrap gap-2">{data.recentCustomers.map((c) => (
              <Link key={c.id} href={`/app/customers/${c.id}`} className="inline-flex min-h-[44px] items-center rounded-full bg-white px-4 text-sm font-semibold shadow-card">{c.name}</Link>
            ))}</div>}
      </section>

      {data.tasks.length > 0 && (
        <section>
          <SectionTitle action={<Link href="/app/tasks" className="text-sm font-semibold text-burgundy">All tasks</Link>}>Upcoming deadlines</SectionTitle>
          <div className="space-y-2">
            {data.tasks.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-card">
                <span className="text-sm font-semibold">{t.title}</span>
                {t.due_date && <Badge tone={t.due_date < today ? 'bad' : statusTone('inquiry')}>{t.due_date < today ? 'Overdue · ' : ''}{formatShort(t.due_date)}</Badge>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

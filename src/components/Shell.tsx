'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, Home, Menu, PartyPopper, Plus, Users } from 'lucide-react';
import { useBusiness } from './BusinessProvider';
import { PoweredBy, cx } from './ui';

const NAV = [
  { href: '/app', label: 'Home', icon: Home, exact: true },
  { href: '/app/events', label: 'Events', icon: PartyPopper },
  { href: '/app/customers', label: 'Customers', icon: Users },
  { href: '/app/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/app/more', label: 'More', icon: Menu },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { business } = useBusiness();
  const active = (n: (typeof NAV)[number]) => (n.exact ? path === n.href : path.startsWith(n.href) || (n.href === '/app/more' && MORE_PREFIXES.some((p) => path.startsWith(p))));

  return (
    <div className="min-h-screen bg-cream-100 md:pl-64">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-cream-300 bg-cream-50 p-5 md:flex">
        <Link href="/app" className="font-display text-2xl text-burgundy">{business.name}</Link>
        <p className="text-xs text-charcoal-300">Smart Events</p>
        <button onClick={() => router.push('/app/events/new')} className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-burgundy font-semibold text-white hover:bg-burgundy-600">
          <Plus className="h-5 w-5" /> New Booking
        </button>
        <nav className="mt-6 space-y-1" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n) ? 'page' : undefined}
              className={cx('flex min-h-[46px] items-center gap-3 rounded-xl px-3 text-sm font-semibold', active(n) ? 'bg-burgundy-50 text-burgundy' : 'text-charcoal-400 hover:bg-cream-200')}>
              <n.icon className="h-5 w-5" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto"><PoweredBy /></div>
      </aside>

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 border-b border-cream-300 bg-cream-50/95 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/app" className="font-display text-xl text-burgundy">{business.name}</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-32 pt-5 md:px-8 md:pb-12 md:pt-8">{children}<PoweredBy className="mt-10 md:hidden" /></main>

      {/* Mobile bottom nav with centred New Booking */}
      <nav className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-cream-300 bg-cream-50 md:hidden" aria-label="Main">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-1 pt-1">
          {NAV.slice(0, 2).map((n) => <NavItem key={n.href} n={n} on={active(n)} />)}
          <div className="relative flex justify-center">
            <button onClick={() => router.push('/app/events/new')} aria-label="New booking"
              className="-mt-7 grid h-16 w-16 place-items-center rounded-full bg-burgundy text-white shadow-lg ring-4 ring-cream-50 active:scale-95">
              <Plus className="h-7 w-7" />
            </button>
          </div>
          {NAV.slice(2, 4).map((n) => <NavItem key={n.href} n={n} on={active(n)} />)}
          <NavItem n={NAV[4]} on={active(NAV[4])} />
        </div>
      </nav>
    </div>
  );
}

const MORE_PREFIXES = ['/app/quotes', '/app/vendors', '/app/expenses', '/app/costing', '/app/templates', '/app/insights', '/app/branding', '/app/portals', '/app/settings', '/app/follow-ups', '/app/tasks', '/app/search'];

function NavItem({ n, on }: { n: (typeof NAV)[number]; on: boolean }) {
  return (
    <Link href={n.href} aria-current={on ? 'page' : undefined} className={cx('flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold', on ? 'text-burgundy' : 'text-charcoal-300')}>
      <n.icon className="h-6 w-6" /> {n.label}
    </Link>
  );
}

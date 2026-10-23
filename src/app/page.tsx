import Link from 'next/link';
import { PoweredBy } from '@/components/ui';

export default function Landing() {
  return (
    <main className="min-h-screen bg-cream-100">
      <div className="kente" />
      <div className="mx-auto max-w-3xl px-5 py-14 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-600">Unaabs Smart Events</p>
        <h1 className="mt-4 font-display text-4xl leading-tight text-charcoal sm:text-5xl">
          Turn your event business from WhatsApp + notebooks into a <span className="text-burgundy">smart, professional business.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-charcoal-300">
          Bookings, quotes, deposits and balances, vendors and profit, plus a beautiful private page for every customer. Built for caterers, small-chops vendors and event planners.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup" className="inline-flex min-h-[52px] items-center rounded-xl bg-burgundy px-7 font-semibold text-white hover:bg-burgundy-600">Start for free</Link>
          <Link href="/login" className="inline-flex min-h-[52px] items-center rounded-xl border border-charcoal-100 bg-white px-7 font-semibold hover:bg-cream-200">Log in</Link>
        </div>
        <ul className="mx-auto mt-12 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
          {['Know who owes you what, instantly', 'Send professional quotes on WhatsApp', 'Give every customer a private event page', 'See your real profit for every event'].map((t) => (
            <li key={t} className="rounded-2xl bg-white p-4 text-sm font-semibold shadow-card">✓ {t}</li>
          ))}
        </ul>
        <PoweredBy className="mt-14" />
      </div>
    </main>
  );
}

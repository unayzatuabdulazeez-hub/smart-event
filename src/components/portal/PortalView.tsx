import { CalendarDays, Clock, MapPin, MessageCircle, Phone, Users } from 'lucide-react';
import type { PortalData } from '@/lib/portal-types';
import { buildJourney } from '@/lib/status';
import { countdownText, daysUntil, formatDate, formatTime } from '@/lib/dates';
import { formatNaira } from '@/lib/money';
import { whatsappLink } from '@/lib/whatsapp';
import { contrast, readableOn, safeColor } from '@/lib/color';
import Journey from '@/components/Journey';
import { PoweredBy } from '@/components/ui';

const card = 'rounded-3xl bg-white p-5 shadow-card border border-cream-300/60';

export function PortalProblem({ kind }: { kind: 'invalid' | 'revoked' | 'expired' | 'error' }) {
  const copy = {
    invalid: ['This link is not valid', 'Please check that you copied the whole link, or ask your event planner to send it again.'],
    revoked: ['This link is no longer active', 'Your planner has turned this link off. Please ask them for a new one.'],
    expired: ['This link has expired', 'For your security, event links expire after a while. Please ask your planner for a fresh link.'],
    error: ['We could not load your event', 'Something went wrong. Please try again in a moment.'],
  }[kind];
  return (
    <main className="grid min-h-screen place-items-center bg-cream-100 px-6">
      <div className="max-w-sm text-center">
        <div className="text-5xl" aria-hidden>🔒</div>
        <h1 className="mt-4 font-display text-3xl">{copy[0]}</h1>
        <p className="mt-2 text-charcoal-300">{copy[1]}</p>
        <PoweredBy className="mt-10" />
      </div>
    </main>
  );
}

export default function PortalView({ data }: { data: PortalData }) {
  const { business: b, event: e, payment } = data;
  // Owners pick any colour: sanitise it, and choose text colours that stay readable (WCAG AA 4.5:1).
  const accent = safeColor(b.primary_color, '#7A1F3D');
  const accent2 = safeColor(b.secondary_color, '#0F7B5F');
  const onAccent = readableOn(accent);
  const accentText = contrast(accent, '#FFFFFF') >= 4.5 ? accent : '#2B2523'; // accent used as text on white
  const accent2Text = contrast(accent2, '#FFFFFF') >= 4.5 ? accent2 : '#2B2523';
  const days = daysUntil(e.event_date);
  const journey = buildJourney({ status: e.status, depositReceived: e.deposit_received, menuConfirmed: e.menu_confirmed, guestCountConfirmed: e.guest_count_confirmed });
  const waHref = whatsappLink(b.whatsapp || b.phone, `Hello ${b.name}, this is ${data.customer_first_name} about ${e.name}.`);
  const cover = e.cover_image_url || b.cover_url;
  const welcome = b.welcome_message || `Thank you for choosing ${b.name}. We are excited to make your occasion special.`;
  const cancelled = e.status === 'cancelled';

  return (
    <main className="min-h-screen bg-cream-100 pb-10" style={{ ['--brand' as string]: accent }}>
      {/* Hero */}
      <header className="relative overflow-hidden" style={{ background: accent, color: onAccent }}>
        {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${accent}cc, ${accent})` }} aria-hidden />
        <div className="relative mx-auto max-w-xl px-5 pb-12 pt-6">
          <div className="flex items-center gap-3">
            {b.logo_url ? <img src={b.logo_url} alt={`${b.name} logo`} className="h-12 w-12 rounded-full bg-white object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-full bg-white/15 font-display text-xl">{b.name[0]}</div>}
            <p className="text-sm font-semibold uppercase tracking-[0.18em]">{b.name}</p>
          </div>
          <p className="mt-10 text-sm font-semibold uppercase tracking-widest opacity-80">Welcome, {data.customer_first_name} ❤️</p>
          <h1 className="mt-2 font-display text-4xl leading-tight">{e.name}</h1>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{formatDate(e.event_date)}</span>
            {e.guest_count != null && <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{e.guest_count} guests</span>}
          </div>
          <p className="mt-5 max-w-md text-[15px] opacity-90">{welcome}</p>
        </div>
        <div className="h-2" style={{ background: `repeating-linear-gradient(90deg, ${accent2} 0 14px, #C9962B 14px 22px)` }} aria-hidden />
      </header>

      <div className="mx-auto -mt-0 max-w-xl space-y-4 px-4 pt-5">
        {cancelled ? (
          <section className={card}><p className="font-display text-2xl">This booking has been cancelled</p><p className="mt-1 text-sm text-charcoal-300">Please contact {b.name} if you have any questions.</p></section>
        ) : (
          <section className={`${card} text-center`} aria-label="Countdown">
            <p className="text-xs font-semibold uppercase tracking-widest text-charcoal-300">Event countdown</p>
            <p className="mt-1 font-display text-5xl" style={{ color: accentText }}>{days > 1 ? days : days === 1 ? '1' : days === 0 ? '🎉' : '✓'}</p>
            <p className="text-lg font-semibold">{countdownText(e.event_date)}</p>
          </section>
        )}

        {e.next_step && !cancelled && (
          <section className={card} style={{ borderColor: accent2 }} aria-label="Next step">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: accent2Text }}>Next step</p>
            <p className="mt-1 font-display text-2xl">{e.next_step}</p>
            {e.next_step_due && <p className="text-sm text-charcoal-300">Due {formatDate(e.next_step_due, { day: 'numeric', month: 'long' })}</p>}
          </section>
        )}

        {e.show_progress && !cancelled && (
          <section className={card} aria-label="Your event journey">
            <h2 className="mb-4 font-display text-2xl">Your event journey</h2>
            <Journey steps={journey} accent={accent2} checkColor={readableOn(accent2)} />
          </section>
        )}

        {(e.start_time || e.venue || (e.services && e.services.length > 0)) && (
          <section className={`${card} space-y-4`} aria-label="Event details">
            <h2 className="font-display text-2xl">Event details</h2>
            <dl className="space-y-3 text-[15px]">
              <div className="flex gap-3"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accentText }} /><div><dt className="sr-only">Date</dt><dd>{formatDate(e.event_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</dd></div></div>
              {e.start_time && <div className="flex gap-3"><Clock className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accentText }} /><div><dt className="sr-only">Time</dt><dd>{formatTime(e.start_time)}{e.end_time ? ` to ${formatTime(e.end_time)}` : ''}</dd></div></div>}
              {e.venue && <div className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accentText }} /><div><dt className="sr-only">Venue</dt><dd className="font-semibold">{e.venue}{e.venue_address && <span className="block font-normal text-charcoal-300">{e.venue_address}</span>}</dd></div></div>}
            </dl>
            {e.services && e.services.length > 0 && (
              <div><h3 className="mb-2 text-sm font-semibold text-charcoal-300">Services booked</h3>
                <ul className="flex flex-wrap gap-2">{(e.booked_items?.length ? e.booked_items : e.services).map((s) => <li key={s} className="rounded-full px-3 py-1.5 text-sm font-semibold" style={{ background: `${accent}14`, color: accentText }}>{s}</li>)}</ul></div>
            )}
          </section>
        )}

        {data.appointments.length > 0 && (
          <section className={card} aria-label="Appointments"><h2 className="mb-3 font-display text-2xl">Upcoming appointment</h2>
            {data.appointments.map((a, i) => <div key={i} className="text-[15px]"><p className="font-semibold">{a.title}</p><p className="text-charcoal-300">{new Date(a.starts_at).toLocaleString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' })}{a.location ? ` · ${a.location}` : ''}</p></div>)}
          </section>
        )}

        {e.show_payment && payment && (
          <section className={card} aria-label="Payment"><h2 className="mb-4 font-display text-2xl">Payment</h2>
            <dl className="space-y-2 text-[15px]">
              <div className="flex justify-between"><dt>Total</dt><dd className="font-semibold">{formatNaira(payment.total)}</dd></div>
              <div className="flex justify-between"><dt>Paid</dt><dd className="font-semibold" style={{ color: accent2Text }}>{formatNaira(payment.paid)}</dd></div>
              <div className="flex justify-between border-t border-charcoal-100 pt-2 font-display text-2xl"><dt>{payment.balance > 0 ? 'Remaining' : 'Remaining'}</dt><dd>{formatNaira(payment.balance)}</dd></div>
            </dl>
            <p className="mt-3 text-sm font-semibold">{e.fully_paid ? '✓ Paid in full. Thank you!' : payment.due_date ? `Balance due ${formatDate(payment.due_date, { day: 'numeric', month: 'long' })}` : ''}</p>
          </section>
        )}

        {e.customer_notes && (
          <section className={card} aria-label="A note from your planner"><h2 className="mb-2 font-display text-2xl">A note from {b.name}</h2><p className="whitespace-pre-line text-[15px]">{e.customer_notes}</p></section>
        )}

        <section className="grid gap-3" aria-label="Contact">
          {waHref && <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl px-6 text-[15px] font-bold" style={{ background: accent, color: onAccent }}><MessageCircle className="h-5 w-5" /> Message {b.name.split(' ')[0]}</a>}
          {b.phone && <a href={`tel:${b.phone}`} className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 bg-white px-6 text-[15px] font-bold" style={{ borderColor: accent, color: accentText }}><Phone className="h-5 w-5" /> Call {b.name.split(' ')[0]}</a>}
        </section>
        {b.location && <p className="text-center text-sm text-charcoal-300">{b.name} · {b.location}</p>}
        <PoweredBy className="pt-4" />
      </div>
    </main>
  );
}

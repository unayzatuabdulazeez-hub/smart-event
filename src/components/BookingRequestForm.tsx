'use client';
import { useState } from 'react';
import { CalendarPlus, MessageCircle } from 'lucide-react';
import { EVENT_TYPES, SERVICE_OPTIONS } from '@/lib/status';
import { whatsappLink } from '@/lib/whatsapp';
import { formatDate, todayStr } from '@/lib/dates';
import { Button, ErrorBox, SelectField, TextArea, TextField, cx } from '@/components/ui';

// Public form on a vendor's page. Sends a REQUEST (not a booking). The vendor reviews it in their app.
export default function BookingRequestForm({ slug, businessName, contact, services, brand, on }: {
  slug: string; businessName: string; contact: string | null; services: string[]; brand: string; on: string;
}) {
  const choices = services && services.length ? services : SERVICE_OPTIONS;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', eventType: 'Wedding', eventDate: '', guests: '', message: '', website: '' });
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  async function send() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Please enter your name.';
    if (f.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a valid phone number, for example 0803 123 4567.';
    if (!f.eventDate) e.eventDate = 'Choose your event date.';
    setErrs(e); setErr(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const res = await fetch('/api/booking-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...f, services: picked }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) { setErr(data.error || 'We could not send your request. Please try again.'); return; }
      setDone(true);
    } catch {
      setErr('Your internet connection may be unstable. Please try again.');
    } finally { setBusy(false); }
  }

  if (done) {
    const summary = `Hello ${businessName}, I just sent a booking request on your page.\nName: ${f.name.trim()}\nEvent: ${f.eventType}, ${formatDate(f.eventDate)}${f.guests ? `\nGuests: ${f.guests}` : ''}${picked.length ? `\nServices: ${picked.join(', ')}` : ''}`;
    const wa = whatsappLink(contact, summary);
    return (
      <div className="space-y-3 rounded-2xl bg-white p-5 text-center shadow-card" role="status">
        <p className="font-display text-2xl">Request sent ✔</p>
        <p className="text-sm text-charcoal-300">{businessName} will review it and contact you on {f.phone.trim()}.</p>
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-5 font-bold" style={{ background: brand, color: on }}><MessageCircle className="h-5 w-5" /> Also tell them on WhatsApp</a>}
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl px-6 font-bold" style={{ background: brand, color: on }}>
        <CalendarPlus className="h-5 w-5" /> Request a booking
      </button>
    );
  }

  return (
    <form onSubmit={(ev) => { ev.preventDefault(); send(); }} className="space-y-4 rounded-2xl bg-white p-5 shadow-card" noValidate>
      <h2 className="font-display text-2xl">Request a booking</h2>
      <p className="text-sm text-charcoal-300">Tell {businessName} about your event. They will contact you to confirm. This is a request, not a confirmed booking.</p>
      <TextField label="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errs.name} autoComplete="name" maxLength={120} />
      <TextField label="Phone / WhatsApp number" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} error={errs.phone} autoComplete="tel" maxLength={20} />
      <SelectField label="Type of event" value={f.eventType} onChange={(e) => setF({ ...f, eventType: e.target.value })}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</SelectField>
      <TextField label="Event date" type="date" min={todayStr()} value={f.eventDate} onChange={(e) => setF({ ...f, eventDate: e.target.value })} error={errs.eventDate} />
      <TextField label="Number of guests (optional)" type="number" inputMode="numeric" min={0} max={100000} value={f.guests} onChange={(e) => setF({ ...f, guests: e.target.value })} />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-charcoal-400">What do you need? (optional)</p>
        <div className="flex flex-wrap gap-2">{choices.map((s) => { const on2 = picked.includes(s); return (
          <button key={s} type="button" aria-pressed={on2} onClick={() => setPicked(on2 ? picked.filter((x) => x !== s) : [...picked, s])}
            className={cx('min-h-[44px] rounded-full border px-4 text-sm font-semibold', on2 ? 'border-emerald bg-emerald-50 text-emerald-700' : 'border-charcoal-100 bg-white')}>{on2 ? '✓ ' : ''}{s}</button>); })}</div>
      </div>
      <TextArea label="Anything else? (optional)" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} maxLength={1000} />
      {/* Honeypot: hidden from people, bots fill it in. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
        <label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></label>
      </div>
      {err && <ErrorBox message={err} />}
      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" className="flex-1" loading={busy} loadingText="Sending...">Send request</Button>
      </div>
      <p className="text-xs text-charcoal-300">We only use your details to answer this request.</p>
    </form>
  );
}

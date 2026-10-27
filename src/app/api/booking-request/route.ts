import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normalizeNgPhone } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

// A visitor on a vendor's public page sends a booking REQUEST. The visitor has no account and no database access:
// this server route validates the input and calls one database function that only the server may call.
const MESSAGES: Record<string, [number, string]> = {
  NOT_ACCEPTING: [409, 'This business is not taking online requests right now. Please contact them on WhatsApp.'],
  NOT_FOUND: [404, 'We could not find this business.'],
  TOO_MANY: [429, 'Too many requests were sent. Please try again later or contact the business on WhatsApp.'],
  BAD_NAME: [400, 'Please enter your name.'],
  BAD_PHONE: [400, 'Please enter a valid Nigerian phone number.'],
  BAD_DATE: [400, 'Please choose an event date that is today or later.'],
  BAD_GUESTS: [400, 'Please enter a valid number of guests.'],
  BAD_MESSAGE: [400, 'Your note is too long.'],
};

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (typeof b !== 'object' || b === null) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  // Honeypot: real people never see or fill this field. Pretend it worked so bots learn nothing.
  if (typeof b.website === 'string' && b.website.trim() !== '') return NextResponse.json({ ok: true });

  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const slug = str(b.slug, 80);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({ error: 'We could not find this business.' }, { status: 404 });

  const phone = str(b.phone, 20);
  const whatsapp = normalizeNgPhone(phone);
  if (!whatsapp) return NextResponse.json({ error: MESSAGES.BAD_PHONE[1] }, { status: 400 });
  const date = str(b.eventDate, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: MESSAGES.BAD_DATE[1] }, { status: 400 });
  const guestsRaw = b.guests === '' || b.guests == null ? null : Number(b.guests);
  if (guestsRaw !== null && (!Number.isInteger(guestsRaw) || guestsRaw < 0 || guestsRaw > 100000)) return NextResponse.json({ error: MESSAGES.BAD_GUESTS[1] }, { status: 400 });
  const services = Array.isArray(b.services) ? b.services.filter((s): s is string => typeof s === 'string').slice(0, 12).map((s) => s.trim().slice(0, 60)) : [];

  const { error } = await supabaseAdmin().rpc('submit_booking_request', {
    p_slug: slug, p_name: str(b.name, 120), p_phone: phone, p_whatsapp: whatsapp, p_event_type: str(b.eventType, 60) || 'Other',
    p_event_date: date, p_guest_count: guestsRaw, p_services: services, p_message: str(b.message, 1000) || null,
  });
  if (error) {
    const code = Object.keys(MESSAGES).find((k) => (error.message ?? '').includes(k));
    if (code) return NextResponse.json({ error: MESSAGES[code][1] }, { status: MESSAGES[code][0] });
    return NextResponse.json({ error: 'We could not send your request. Please try again or contact the business on WhatsApp.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

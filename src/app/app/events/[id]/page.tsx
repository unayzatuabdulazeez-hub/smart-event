'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, CopyPlus, FilePlus2, MapPin, MessageCircle, Pencil, Save, Trash2, Users } from 'lucide-react';
import { useBusiness } from '@/components/BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must, useQuery } from '@/lib/useQuery';
import { friendlyError } from '@/lib/errors';
import { countdownText, formatDate, formatTime } from '@/lib/dates';
import { formatNaira } from '@/lib/money';
import { templates } from '@/lib/whatsapp';
import { EVENT_STATUSES, buildJourney, statusLabel } from '@/lib/status';
import { MENU_LABEL, GUESTS_LABEL } from '@/lib/bookingDefaults';
import type { BookingItem, Customer, EventRow, Financials, Payment, Portal, Task } from '@/lib/types';
import { Badge, Button, Card, EmptyState, ErrorBox, ListSkeleton, Modal, SectionTitle, TextField, statusTone, useToast } from '@/components/ui';
import Journey from '@/components/Journey';
import WhatsAppDialog from '@/components/WhatsAppDialog';
import PaymentsPanel from '@/components/event/PaymentsPanel';
import ChecklistPanel from '@/components/event/ChecklistPanel';
import { AddTaskButton, TaskRows } from '@/components/TaskList';
import VendorsPanel, { type EventVendor, type VendorLite } from '@/components/event/VendorsPanel';
import CostsPanel, { type Expense } from '@/components/event/CostsPanel';
import PortalPanel from '@/components/event/PortalPanel';
import NotesPanel from '@/components/event/NotesPanel';
import EditEventModal from '@/components/event/EditEventModal';
import RetentionPanel from '@/components/event/RetentionPanel';
import AppointmentsPanel from '@/components/event/AppointmentsPanel';

function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const autoPay = useSearchParams().get('pay') === '1';
  const { business } = useBusiness();
  const { toast, node } = useToast();
  const sb = supabaseBrowser();
  const [editing, setEditing] = useState(false);
  const [wa, setWa] = useState<null | 'confirmation' | 'reminder' | 'update' | 'ready'>(null);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatDate, setRepeatDate] = useState('');
  const [tplOpen, setTplOpen] = useState(false);
  const [tplName, setTplName] = useState('');
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useQuery(async () => {
    const event = must(await sb.from('events').select('*').eq('id', id).eq('business_id', business.id).maybeSingle()) as EventRow | null;
    if (!event) return null;
    const [cust, items, fin, pays, checks, tasks, evv, exps, portals, fups, vendors] = await Promise.all([
      sb.from('customers').select('*').eq('id', event.customer_id).single(),
      sb.from('booking_items').select('*').eq('event_id', id).order('sort'),
      sb.from('event_financials').select('*').eq('event_id', id).single(),
      sb.from('payments').select('*').eq('event_id', id).order('paid_on', { ascending: false }).order('created_at', { ascending: false }),
      sb.from('checklist_items').select('id,label,done,sort').eq('event_id', id).order('sort'),
      sb.from('tasks').select('*').eq('event_id', id).order('due_date', { ascending: true, nullsFirst: false }),
      sb.from('event_vendors').select('id,vendor_id,price,status,due_date,notes,vendors(name,service,phone,whatsapp),vendor_payments(id,amount,paid_on,note)').eq('event_id', id).order('created_at'),
      sb.from('event_expenses').select('*').eq('event_id', id).order('spent_on', { ascending: false }),
      sb.from('customer_portals').select('id,event_id,customer_id,created_at,expires_at,revoked_at,last_accessed_at,access_count').eq('event_id', id).order('created_at', { ascending: false }),
      sb.from('follow_ups').select('id,kind,due_date,done').eq('event_id', id),
      sb.from('vendors').select('id,name,service').eq('business_id', business.id).order('name'),
    ]);
    return {
      event, customer: must(cust) as Customer, items: must(items) as BookingItem[], fin: must(fin) as Financials, payments: must(pays) as Payment[],
      checks: must(checks) as any[], tasks: must(tasks) as Task[], evv: must(evv) as unknown as EventVendor[], exps: must(exps) as Expense[],
      portals: must(portals) as Portal[], fups: must(fups) as any[], vendors: must(vendors) as VendorLite[],
    };
  }, [id, business.id]);

  if (loading && !data) return <ListSkeleton rows={5} />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <EmptyState emoji="🔎" title="Booking not found" action={<Link href="/app/events"><Button variant="secondary">Back to events</Button></Link>} />;

  const { event, customer, items, fin, payments, checks, tasks, evv, exps, portals, fups, vendors } = data;
  const total = Number(fin.total), paid = Number(fin.paid), balance = Number(fin.balance);
  const first = customer.name.split(' ')[0];
  const ctx = { customer: first, business: business.name, event: event.name, total, paid, balance, dueDate: event.payment_due_date ? formatDate(event.payment_due_date) : null };
  const chk = (label: string) => checks.some((c) => c.label === label && c.done);
  const depositReceived = paid > 0 && paid >= Math.min(Number(event.deposit_required), total);
  const journey = buildJourney({ status: event.status, depositReceived, menuConfirmed: chk(MENU_LABEL), guestCountConfirmed: chk(GUESTS_LABEL) });
  const vendorCost = evv.filter((v) => v.status !== 'cancelled').reduce((s, v) => s + Number(v.price), 0);
  const phone = customer.whatsapp || customer.phone;

  async function setStatus(status: string) {
    const { error } = await sb.from('events').update({ status }).eq('id', event.id);
    if (error) { toast.err(friendlyError(error, 'Unable to update the status.')); return; }
    toast.ok(`Status: ${statusLabel(status)}`); reload();
  }
  async function repeat() {
    if (!repeatDate) { toast.err('Choose a date for the new booking.'); return; }
    setBusy(true);
    const { data: newId, error } = await sb.rpc('repeat_booking', { p_event_id: event.id, p_new_date: repeatDate });
    setBusy(false);
    if (error) { toast.err(friendlyError(error, 'Unable to create the repeat booking.')); return; }
    router.push(`/app/events/${newId}`);
  }
  async function saveTemplate() {
    if (!tplName.trim()) { toast.err('Give the package a name.'); return; }
    setBusy(true);
    const { error } = await sb.from('event_templates').insert({
      business_id: business.id, name: tplName.trim(), event_type: event.event_type, guest_count: event.guest_count, services: event.services,
      items: items.map((i) => ({ service: i.service, description: i.description, quantity: i.quantity, unit_price: i.unit_price })),
    });
    setBusy(false);
    if (error) { toast.err(friendlyError(error, 'Unable to save the package.')); return; }
    setTplOpen(false); setTplName(''); toast.ok('Package saved');
  }
  async function remove() {
    setBusy(true);
    const { error } = await sb.from('events').delete().eq('id', event.id);
    setBusy(false); setDelOpen(false);
    if (error) { toast.err(friendlyError(error, 'Unable to delete this booking.')); return; }
    router.replace('/app/events');
  }

  return (
    <div className="space-y-7">
      {node}
      <div>
        <Link href="/app/events" className="text-sm font-semibold text-burgundy">← All events</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone="brand">{event.booking_number}</Badge><Badge tone={statusTone(event.status)}>{statusLabel(event.status)}</Badge>
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight">{event.name}</h1>
        <p className="mt-1 text-charcoal-300"><Link href={`/app/customers/${customer.id}`} className="font-semibold text-burgundy">{customer.name}</Link> · {event.event_type}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-charcoal-400">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{formatDate(event.event_date)}{event.start_time ? ` · ${formatTime(event.start_time)}` : ''}</span>
          <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{event.guest_count} guests</span>
          {event.venue && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{event.venue}</span>}
          {event.status !== 'completed' && event.status !== 'cancelled' && <Badge tone="warn">{countdownText(event.event_date)}</Badge>}
        </div>
      </div>

      <Card className="space-y-4">
        <label className="block text-sm font-semibold text-charcoal-400" htmlFor="status">Booking status</label>
        <select id="status" value={event.status} onChange={(e) => setStatus(e.target.value)} className="min-h-[48px] w-full rounded-xl border border-charcoal-100 bg-white px-3 text-[16px]">
          {EVENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="whatsapp" size="sm" onClick={() => setWa('confirmation')}><MessageCircle className="h-4 w-4" /> Confirmation</Button>
          <Button variant="whatsapp" size="sm" onClick={() => setWa('reminder')}><MessageCircle className="h-4 w-4" /> Payment reminder</Button>
          <Button variant="whatsapp" size="sm" onClick={() => setWa('update')}><MessageCircle className="h-4 w-4" /> Event update</Button>
          <Button variant="whatsapp" size="sm" onClick={() => setWa('ready')}><MessageCircle className="h-4 w-4" /> Ready</Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Link href={`/app/quotes/new?event=${event.id}`} className="contents"><Button variant="secondary" size="sm"><FilePlus2 className="h-4 w-4" /> Create quote</Button></Link>
          <Button variant="secondary" size="sm" onClick={() => setRepeatOpen(true)}><CopyPlus className="h-4 w-4" /> Repeat booking</Button>
          <Button variant="secondary" size="sm" onClick={() => setTplOpen(true)}><Save className="h-4 w-4" /> Save as package</Button>
        </div>
      </Card>

      <section>
        <SectionTitle>Event journey</SectionTitle>
        <Card><Journey steps={journey} /></Card>
      </section>

      <PaymentsPanel event={event} fin={fin} payments={payments} autoOpen={autoPay} onChanged={reload} toast={toast} />

      <section>
        <SectionTitle>Services &amp; pricing</SectionTitle>
        <Card className="space-y-2 text-sm">
          {items.map((i) => (
            <div key={i.id} className="flex justify-between gap-3 border-b border-cream-200 pb-2 last:border-0">
              <div><p className="font-semibold">{i.service}</p><p className="text-xs text-charcoal-300">{i.quantity} × {formatNaira(i.unit_price)}{i.description ? ` · ${i.description}` : ''}</p></div>
              <p className="font-semibold">{formatNaira(Number(i.quantity) * Number(i.unit_price))}</p>
            </div>
          ))}
          <div className="flex justify-between pt-1"><span>Subtotal</span><span>{formatNaira(fin.subtotal)}</span></div>
          {event.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{formatNaira(event.discount)}</span></div>}
          {(event.additional_charges + event.delivery_fee + event.service_fee) > 0 && <div className="flex justify-between"><span>Additional charges</span><span>{formatNaira(Number(event.additional_charges) + Number(event.delivery_fee) + Number(event.service_fee))}</span></div>}
          <div className="flex justify-between border-t border-charcoal-100 pt-2 font-display text-xl"><span>Grand total</span><span>{formatNaira(total)}</span></div>
        </Card>
      </section>

      <ChecklistPanel businessId={business.id} eventId={event.id} items={checks} onChanged={reload} toast={toast} />

      <section id="tasks">
        <SectionTitle action={<AddTaskButton businessId={business.id} eventId={event.id} onSaved={reload} />}>Things to do</SectionTitle>
        <Card>{tasks.length === 0 ? <p className="text-sm text-charcoal-300">No tasks for this event yet.</p> : <TaskRows tasks={tasks} onChanged={reload} toast={toast} />}</Card>
      </section>

      <AppointmentsPanel event={event} business={business} customer={customer} fin={fin} reload={reload} toast={toast} />

      <VendorsPanel businessId={business.id} eventId={event.id} rows={evv} allVendors={vendors} onChanged={reload} toast={toast} />
      <CostsPanel businessId={business.id} eventId={event.id} revenue={total} vendorCost={vendorCost} expenses={exps} onChanged={reload} toast={toast} />
      <NotesPanel key={event.updated_at ?? event.id} event={event} onChanged={reload} toast={toast} />
      <PortalPanel businessId={business.id} eventId={event.id} customerId={customer.id} customerName={customer.name} customerPhone={phone} businessName={business.name} eventName={event.name} portals={portals} onChanged={reload} toast={toast} />
      {(event.status === 'completed' || event.status === 'ready' || event.status === 'event_day') && (
        <RetentionPanel businessId={business.id} eventId={event.id} customerId={customer.id} phone={phone} ctx={ctx} followUps={fups} onChanged={reload} toast={toast} />
      )}

      <button onClick={() => setDelOpen(true)} className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-coral-600"><Trash2 className="h-4 w-4" /> Delete booking</button>

      {wa && <WhatsAppDialog open onClose={() => setWa(null)} phone={phone} title="Send on WhatsApp" message={templates[wa === 'confirmation' ? 'confirmation' : wa === 'reminder' ? 'reminder' : wa === 'update' ? 'update' : 'ready'](ctx)} />}
      {editing && <EditEventModal open onClose={() => setEditing(false)} event={event} items={items} paid={paid} onSaved={() => { toast.ok('Booking updated'); reload(); }} />}
      <Modal open={repeatOpen} onClose={() => setRepeatOpen(false)} title="Repeat this booking">
        <div className="space-y-4"><p className="text-sm text-charcoal-300">Creates a brand-new booking with the same customer, services and prices. This booking is not changed.</p>
          <TextField label="Date of the new event" type="date" value={repeatDate} onChange={(e) => setRepeatDate(e.target.value)} />
          <Button className="w-full" loading={busy} loadingText="Creating..." onClick={repeat}>Create repeat booking</Button></div>
      </Modal>
      <Modal open={tplOpen} onClose={() => setTplOpen(false)} title="Save as package">
        <div className="space-y-4"><TextField label="Package name" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Premium Wedding Catering, 350 guests" />
          <Button className="w-full" loading={busy} loadingText="Saving..." onClick={saveTemplate}>Save package</Button></div>
      </Modal>
      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Delete this booking?">
        <p className="text-sm text-charcoal-300">This permanently removes the booking, its payments, tasks and portal links. Consider setting the status to Cancelled instead.</p>
        <div className="mt-4 flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => setDelOpen(false)}>Keep</Button><Button variant="danger" className="flex-1" loading={busy} onClick={remove}>Delete</Button></div>
      </Modal>
    </div>
  );
}
export default function Page() { return <Suspense><EventDetail /></Suspense>; }

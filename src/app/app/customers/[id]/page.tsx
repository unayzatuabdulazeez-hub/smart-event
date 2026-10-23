'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { MessageCircle, Pencil, Plus, Trash2, Globe, HandCoins } from 'lucide-react';
import { useBusiness } from '@/components/BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must, useQuery } from '@/lib/useQuery';
import { loadEventList } from '@/lib/loaders';
import { formatDate, formatShort, todayStr } from '@/lib/dates';
import { formatNaira } from '@/lib/money';
import { friendlyError } from '@/lib/errors';
import { templates } from '@/lib/whatsapp';
import type { Customer, Payment } from '@/lib/types';
import { Button, Card, EmptyState, ErrorBox, ListSkeleton, Modal, SectionTitle, Stat, useToast } from '@/components/ui';
import EventCard from '@/components/EventCard';
import CustomerForm from '@/components/CustomerForm';
import WhatsAppDialog from '@/components/WhatsAppDialog';

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { business } = useBusiness();
  const { toast, node } = useToast();
  const [editing, setEditing] = useState(false);
  const [wa, setWa] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const { data, loading, error, reload } = useQuery(async () => {
    const sb = supabaseBrowser();
    const customer = must(await sb.from('customers').select('*').eq('id', id).eq('business_id', business.id).maybeSingle()) as Customer | null;
    if (!customer) return null;
    const events = await loadEventList({ businessId: business.id, customerId: id, limit: 100, ascending: false });
    const ids = events.map((e) => e.id);
    const payments = ids.length
      ? (must(await sb.from('payments').select('*').in('event_id', ids).order('paid_on', { ascending: false }).limit(50)) as Payment[])
      : [];
    return { customer, events, payments };
  }, [id, business.id]);

  if (loading) return <ListSkeleton rows={4} />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <EmptyState emoji="🔎" title="Customer not found" action={<Link href="/app/customers"><Button variant="secondary">Back to customers</Button></Link>} />;

  const { customer, events, payments } = data;
  const live = events.filter((e) => e.status !== 'cancelled');
  const totalSpent = live.reduce((s, e) => s + ((e.total ?? 0) - (e.balance ?? 0)), 0);
  const outstanding = live.filter((e) => e.status !== 'completed' || (e.balance ?? 0) > 0).reduce((s, e) => s + Math.max(e.balance ?? 0, 0), 0);
  const today = todayStr();
  const upcoming = live.filter((e) => e.event_date >= today && e.status !== 'completed').sort((a, b) => a.event_date.localeCompare(b.event_date));
  const previous = events.filter((e) => !upcoming.includes(e));
  const nextEvent = upcoming[0];
  const owing = live.find((e) => (e.balance ?? 0) > 0);
  const eventName = (eid: string) => events.find((e) => e.id === eid)?.name ?? '';

  async function remove() {
    try {
      const { error } = await supabaseBrowser().from('customers').delete().eq('id', customer.id);
      if (error) throw error;
      router.replace('/app/customers');
    } catch (e) { setConfirmDel(false); toast.err(friendlyError(e, 'Unable to delete this customer. Customers with bookings cannot be deleted.')); }
  }

  return (
    <div className="space-y-6">
      {node}
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-burgundy text-2xl font-display text-white">{customer.name[0]?.toUpperCase()}</div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl">{customer.name}</h1>
          <p className="text-sm text-charcoal-300">Customer since {formatDate(customer.created_at.slice(0, 10), { month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Link href={`/app/events/new?customer=${customer.id}`} className="contents"><Button><Plus className="h-4 w-4" /> New Booking</Button></Link>
        {owing ? <Link href={`/app/events/${owing.id}?pay=1`} className="contents"><Button variant="gold"><HandCoins className="h-4 w-4" /> Record Payment</Button></Link> : <Button variant="gold" disabled><HandCoins className="h-4 w-4" /> Record Payment</Button>}
        <Button variant="whatsapp" onClick={() => setWa(true)}><MessageCircle className="h-4 w-4" /> Message</Button>
        {nextEvent ? <Link href={`/app/events/${nextEvent.id}#portal`} className="contents"><Button variant="secondary"><Globe className="h-4 w-4" /> View Portal</Button></Link> : <Button variant="secondary" disabled><Globe className="h-4 w-4" /> View Portal</Button>}
      </div>

      {nextEvent && (
        <Card className="border-burgundy/20 bg-burgundy-50">
          <p className="text-xs font-semibold uppercase tracking-wide text-burgundy">Upcoming event</p>
          <p className="mt-1 font-display text-2xl">{nextEvent.name}</p>
          <p className="text-sm text-charcoal-400">{formatDate(nextEvent.event_date)} · {nextEvent.guest_count} guests</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Total" value={formatNaira(nextEvent.total)} />
            <Stat label="Paid" value={formatNaira((nextEvent.total ?? 0) - (nextEvent.balance ?? 0))} tone="good" />
            <Stat label="Balance" value={formatNaira(nextEvent.balance)} tone={(nextEvent.balance ?? 0) > 0 ? 'bad' : 'good'} />
          </div>
        </Card>
      )}

      <Card>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Total spent" value={formatNaira(totalSpent)} tone="good" />
          <Stat label="Outstanding" value={formatNaira(outstanding)} tone={outstanding > 0 ? 'bad' : undefined} />
        </div>
      </Card>

      <Card className="space-y-2 text-sm">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl">Contact</h2>
          <button onClick={() => setEditing(true)} className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-burgundy"><Pencil className="h-4 w-4" /> Edit</button></div>
        {[['Phone', customer.phone], ['WhatsApp', customer.whatsapp], ['Email', customer.email], ['Address', customer.address], ['Prefers', customer.preferred_contact]].map(([k, v]) => v ? <p key={k}><span className="text-charcoal-300">{k}: </span>{v}</p> : null)}
        {customer.notes && <p className="rounded-xl bg-cream-100 p-3"><span className="font-semibold">Private notes: </span>{customer.notes}</p>}
      </Card>

      <section>
        <SectionTitle>Events</SectionTitle>
        {events.length === 0
          ? <EmptyState title="No events yet" body="Create the first booking for this customer." action={<Link href={`/app/events/new?customer=${customer.id}`}><Button>New Booking</Button></Link>} />
          : <div className="space-y-3">{[...upcoming, ...previous].map((e) => <EventCard key={e.id} e={e} />)}</div>}
      </section>

      <section>
        <SectionTitle>Payment history</SectionTitle>
        {payments.length === 0 ? <p className="rounded-2xl bg-white p-4 text-sm text-charcoal-300 shadow-card">No payments recorded yet.</p> : (
          <div className="divide-y divide-cream-200 rounded-2xl bg-white shadow-card">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div><p className="font-semibold">{formatNaira(p.amount)}</p><p className="text-xs text-charcoal-300">{formatShort(p.paid_on)} · {p.method.replace('_', ' ')} · {eventName(p.event_id)}</p></div>
              </div>
            ))}
          </div>
        )}
      </section>

      <button onClick={() => setConfirmDel(true)} className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-coral-600"><Trash2 className="h-4 w-4" /> Delete customer</button>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit customer">
        <CustomerForm businessId={business.id} customer={customer} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); toast.ok('Customer saved'); reload(); }} />
      </Modal>
      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title="Delete this customer?">
        <p className="text-sm text-charcoal-300">This cannot be undone. Customers who have bookings cannot be deleted.</p>
        <div className="mt-4 flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => setConfirmDel(false)}>Keep</Button><Button variant="danger" className="flex-1" onClick={remove}>Delete</Button></div>
      </Modal>
      <WhatsAppDialog open={wa} onClose={() => setWa(false)} title={`Message ${customer.name}`} phone={customer.whatsapp || customer.phone}
        message={nextEvent
          ? templates.update({ customer: customer.name.split(' ')[0], business: business.name, event: nextEvent.name, total: nextEvent.total ?? 0, paid: 0, balance: nextEvent.balance ?? 0 })
          : `Hello ${customer.name.split(' ')[0]} ❤️\n\nThis is ${business.name}.`} />
    </div>
  );
}

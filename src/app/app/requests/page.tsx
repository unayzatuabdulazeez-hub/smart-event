'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { useBusiness } from '@/components/BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must, useQuery } from '@/lib/useQuery';
import { friendlyError } from '@/lib/errors';
import { whatsappLink } from '@/lib/whatsapp';
import { formatDate } from '@/lib/dates';
import { Badge, Button, Card, EmptyState, ErrorBox, ListSkeleton, PageHeader, useToast } from '@/components/ui';

interface Req {
  id: string; name: string; phone: string; whatsapp: string; event_type: string; event_date: string; guest_count: number | null;
  services: string[]; message: string | null; status: 'new' | 'accepted' | 'declined'; event_id: string | null; created_at: string;
}

export default function Requests() {
  const { business } = useBusiness();
  const router = useRouter();
  const { toast, node } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const { data, loading, error, reload } = useQuery(async () => must(await supabaseBrowser().from('booking_requests').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(100)) as Req[], [business.id]);

  async function accept(r: Req) {
    setBusy(r.id + 'a');
    const { data: id, error: e } = await supabaseBrowser().rpc('accept_booking_request', { p_id: r.id });
    setBusy(null);
    if (e) { toast.err(e.message.includes('ALREADY_HANDLED') ? 'This request was already handled.' : friendlyError(e, 'Unable to accept this request.')); reload(); return; }
    toast.ok('Booking created'); router.push(`/app/events/${id as string}`);
  }
  async function decline(r: Req) {
    if (!window.confirm(`Decline the request from ${r.name}?`)) return;
    setBusy(r.id + 'd');
    const { error: e } = await supabaseBrowser().from('booking_requests').update({ status: 'declined' }).eq('id', r.id).eq('status', 'new');
    setBusy(null);
    if (e) { toast.err(friendlyError(e, 'Unable to decline this request.')); return; }
    toast.ok('Request declined'); reload();
  }

  const fresh = (data ?? []).filter((r) => r.status === 'new');
  const rest = (data ?? []).filter((r) => r.status !== 'new');
  const card = (r: Req) => {
    const wa = whatsappLink(r.whatsapp, `Hello ${r.name}, this is ${business.name}. Thank you for your booking request for your ${r.event_type} on ${formatDate(r.event_date)}.`);
    return (
      <Card key={r.id} className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{r.name}</p>
            <p className="text-sm text-charcoal-300">{r.event_type} · {formatDate(r.event_date)}{r.guest_count ? ` · ${r.guest_count} guests` : ''}</p>
          </div>
          <Badge tone={r.status === 'new' ? 'warn' : r.status === 'accepted' ? 'good' : 'bad'}>{r.status === 'new' ? 'New' : r.status === 'accepted' ? 'Accepted' : 'Declined'}</Badge>
        </div>
        {r.services.length > 0 && <p className="text-sm">Needs: {r.services.join(', ')}</p>}
        {r.message && <p className="rounded-xl bg-cream-100 p-3 text-sm">{r.message}</p>}
        <p className="text-sm text-charcoal-300">{r.phone}</p>
        <div className="flex flex-wrap gap-2">
          {r.status === 'new' && <Button size="sm" loading={busy === r.id + 'a'} loadingText="Creating..." onClick={() => accept(r)}>Accept and create booking</Button>}
          {r.status === 'new' && <Button size="sm" variant="secondary" loading={busy === r.id + 'd'} onClick={() => decline(r)}>Decline</Button>}
          {r.status === 'accepted' && r.event_id && <Button size="sm" variant="secondary" onClick={() => router.push(`/app/events/${r.event_id}`)}>Open booking</Button>}
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${r.name}`} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-emerald px-3.5 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-5">{node}
      <PageHeader title="Requests" subtitle="Customers who asked to book from your public page." />
      {loading ? <ListSkeleton /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data || data.length === 0
        ? <EmptyState emoji="📩" title="No requests yet" body="When a customer fills the booking form on your public page, it appears here. Share your public page link to start receiving requests." />
        : <div className="space-y-3">
            {fresh.length > 0 && <p className="text-sm font-semibold">{fresh.length} waiting for you</p>}
            {fresh.map(card)}
            {rest.length > 0 && <p className="pt-2 text-sm font-semibold text-charcoal-300">Earlier requests</p>}
            {rest.map(card)}
          </div>}
    </div>
  );
}

'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useBusiness } from '@/components/BusinessProvider';
import { useQuery } from '@/lib/useQuery';
import BookingWizard from '@/components/BookingWizard';
import { EmptyState, ErrorBox, ListSkeleton, PageHeader } from '@/components/ui';
import type { EventRow } from '@/lib/types';

export default function EditBooking() {
  const { id } = useParams<{ id: string }>();
  const { business } = useBusiness();
  const { data, loading, error, reload } = useQuery(async () => {
    const sb = supabaseBrowser();
    const { data: ev, error: e } = await sb.from('events').select('*').eq('id', id).eq('business_id', business.id).maybeSingle();
    if (e) throw e;
    if (!ev) return null;
    const { data: items, error: ie } = await sb.from('booking_items').select('service,description,quantity,unit_price').eq('event_id', id).order('sort');
    if (ie) throw ie;
    return { event: ev as EventRow, items: (items ?? []).map((i) => ({ ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })) };
  }, [id, business.id]);
  if (loading && !data) return <ListSkeleton />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <EmptyState emoji="🔎" title="We couldn't find that booking" action={<Link href="/app/events" className="font-semibold text-burgundy">Back to events</Link>} />;
  return (<><PageHeader title="Edit booking" subtitle={data.event.name} />
    <BookingWizard businessId={business.id} enabledServices={business.services} initial={data} /></>);
}

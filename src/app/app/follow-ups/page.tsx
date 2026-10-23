'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useBusiness } from '@/components/BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must, useQuery } from '@/lib/useQuery';
import { friendlyError } from '@/lib/errors';
import { formatShort, todayStr } from '@/lib/dates';
import { templates } from '@/lib/whatsapp';
import { Badge, Button, Card, EmptyState, ErrorBox, ListSkeleton, PageHeader, useToast } from '@/components/ui';
import WhatsAppDialog from '@/components/WhatsAppDialog';

export default function FollowUps() {
  const { business } = useBusiness();
  const { toast, node } = useToast();
  const [wa, setWa] = useState<any | null>(null);
  const today = todayStr();
  const { data, loading, error, reload } = useQuery(async () => must(await supabaseBrowser().from('follow_ups')
    .select('id,kind,due_date,event_id,events(name),customers(name,phone,whatsapp)').eq('business_id', business.id).eq('done', false).order('due_date').limit(100)) as any[], [business.id]);
  async function done(id: string) {
    const { error } = await supabaseBrowser().from('follow_ups').update({ done: true }).eq('id', id);
    if (error) toast.err(friendlyError(error, 'Unable to update.')); else reload();
  }
  return (
    <div className="space-y-5">{node}
      <PageHeader title="Follow-ups" subtitle="Gentle reminders to stay in touch. Nothing is sent automatically." />
      {loading ? <ListSkeleton /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data || data.length === 0
        ? <EmptyState emoji="🌿" title="No follow-ups due" body="After an event is completed, set a reminder to thank the customer or ask for feedback." />
        : <div className="space-y-3">{data.map((f) => (
            <Card key={f.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2"><div><Link href={`/app/events/${f.event_id}`} className="font-semibold text-burgundy">{f.events?.name}</Link><p className="text-sm text-charcoal-300">{f.customers?.name}</p></div>
                <Badge tone={f.due_date <= today ? 'warn' : 'neutral'}>{f.due_date <= today ? 'Due · ' : ''}{formatShort(f.due_date)}</Badge></div>
              <div className="flex gap-2"><Button size="sm" variant="whatsapp" onClick={() => setWa(f)}>Message</Button><Button size="sm" variant="secondary" onClick={() => done(f.id)}>Mark done</Button></div>
            </Card>))}</div>}
      {wa && <WhatsAppDialog open onClose={() => setWa(null)} title="Follow up" phone={wa.customers?.whatsapp || wa.customers?.phone}
        message={templates.followUp({ customer: (wa.customers?.name ?? '').split(' ')[0], business: business.name, event: wa.events?.name ?? '', total: 0, paid: 0, balance: 0 })} />}
    </div>
  );
}

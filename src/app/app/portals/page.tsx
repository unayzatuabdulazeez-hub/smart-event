'use client';
import Link from 'next/link';
import { useBusiness } from '@/components/BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must, useQuery } from '@/lib/useQuery';
import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/lib/dates';
import { Badge, Button, Card, EmptyState, ErrorBox, ListSkeleton, PageHeader, useToast } from '@/components/ui';

export default function Portals() {
  const { business } = useBusiness();
  const { toast, node } = useToast();
  const { data, loading, error, reload } = useQuery(async () => must(await supabaseBrowser().from('customer_portals')
    .select('id,event_id,created_at,expires_at,revoked_at,last_accessed_at,access_count,events(name),customers(name)').eq('business_id', business.id).order('created_at', { ascending: false }).limit(100)) as any[], [business.id]);
  const now = Date.now();
  async function revoke(id: string) {
    const { error } = await supabaseBrowser().from('customer_portals').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    if (error) toast.err(friendlyError(error, 'Unable to revoke the link.')); else { toast.ok('Link revoked'); reload(); }
  }
  const d = (s: string) => formatDate(s.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="space-y-5">{node}
      <PageHeader title="Portal links" subtitle="Private pages you have shared with customers" />
      {loading ? <ListSkeleton /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data || data.length === 0
        ? <EmptyState emoji="🔗" title="No portal links yet" body="Open a booking and create a portal link to share it with your customer." />
        : <div className="space-y-3">{data.map((p) => {
            const state = p.revoked_at ? ['bad', 'Revoked'] : new Date(p.expires_at).getTime() <= now ? ['warn', 'Expired'] : ['good', 'Active'];
            const active = state[1] === 'Active';
            return (
              <Card key={p.id} className="space-y-2 text-sm">
                <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{p.customers?.name}</p><p className="text-charcoal-300">{p.events?.name}</p></div><Badge tone={state[0]}>{state[1]}</Badge></div>
                <p className="text-charcoal-300">Created {d(p.created_at)} · Expires {d(p.expires_at)}</p>
                <p className="text-charcoal-300">Last opened: {p.last_accessed_at ? d(p.last_accessed_at) : 'not yet'} · {p.access_count} visit{p.access_count === 1 ? '' : 's'}</p>
                <div className="flex gap-2 pt-1"><Link href={`/app/events/${p.event_id}#portal`} className="contents"><Button size="sm" variant="secondary">{active ? 'Manage / new link' : 'Generate new link'}</Button></Link>{active && <Button size="sm" variant="ghost" onClick={() => revoke(p.id)}>Revoke</Button>}</div>
              </Card>);
          })}</div>}
    </div>
  );
}

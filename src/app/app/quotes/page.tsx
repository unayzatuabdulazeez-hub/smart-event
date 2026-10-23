'use client';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useBusiness } from '@/components/BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must, useQuery } from '@/lib/useQuery';
import { formatShort } from '@/lib/dates';
import { Badge, Button, EmptyState, ErrorBox, ListSkeleton, PageHeader, statusTone } from '@/components/ui';

const LABEL: Record<string, string> = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined', expired: 'Expired' };

export default function Quotes() {
  const { business } = useBusiness();
  const { data, loading, error, reload } = useQuery(async () => {
    const sb = supabaseBrowser();
    const qs = must(await sb.from('quotes').select('id,quote_number,title,status,issue_date,expiry_date,customers(name)').eq('business_id', business.id).order('created_at', { ascending: false }).limit(100)) as any[];
    if (!qs.length) return [];
    const items = must(await sb.from('quote_items').select('quote_id,quantity,unit_price').in('quote_id', qs.map((q) => q.id))) as any[];
    const full = must(await sb.from('quotes').select('id,discount,additional_charges').in('id', qs.map((q) => q.id))) as any[];
    return qs.map((q) => {
      const sub = items.filter((i) => i.quote_id === q.id).reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);
      const f = full.find((x) => x.id === q.id);
      return { ...q, total: Math.max(sub - Number(f?.discount ?? 0) + Number(f?.additional_charges ?? 0), 0) };
    });
  }, [business.id]);
  return (
    <div className="space-y-5">
      <PageHeader title="Quotes" subtitle="Professional quotations, ready for WhatsApp" action={<Link href="/app/quotes/new"><Button size="sm"><Plus className="h-4 w-4" /> New</Button></Link>} />
      {loading ? <ListSkeleton /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data || data.length === 0
        ? <EmptyState emoji="📄" title="No quotes yet" body="Create a quote and send it to your customer on WhatsApp." action={<Link href="/app/quotes/new"><Button>Create Quote</Button></Link>} />
        : <div className="space-y-3">{data.map((q: any) => (
            <Link key={q.id} href={`/app/quotes/${q.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card">
              <div className="min-w-0"><p className="truncate font-semibold">{q.title}</p><p className="truncate text-sm text-charcoal-300">{q.quote_number} · {q.customers?.name} · {formatShort(q.issue_date)}</p></div>
              <div className="text-right"><p className="font-semibold">₦{Number(q.total).toLocaleString('en-NG')}</p><Badge tone={statusTone(q.status)}>{LABEL[q.status]}</Badge></div>
            </Link>))}</div>}
    </div>
  );
}

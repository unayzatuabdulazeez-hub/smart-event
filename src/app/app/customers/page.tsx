'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useBusiness } from '@/components/BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must, useQuery } from '@/lib/useQuery';
import { safeTerm } from '@/lib/search';
import { Button, EmptyState, ErrorBox, ListSkeleton, PageHeader } from '@/components/ui';

const PAGE = 25;

export default function Customers() {
  const { business } = useBusiness();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const { data, loading, error, reload } = useQuery(async () => {
    const sb = supabaseBrowser();
    const t = safeTerm(q);
    const digits = t.replace(/\D/g, '').replace(/^0/, '');
    let query = sb.from('customers').select('id,name,phone,whatsapp,created_at', { count: 'exact' }).eq('business_id', business.id).order('name').range(page * PAGE, page * PAGE + PAGE - 1);
    if (t) query = query.or([`name.ilike.%${t}%`, digits.length >= 3 ? `phone.ilike.%${digits}%` : null, digits.length >= 3 ? `whatsapp.ilike.%${digits}%` : null].filter(Boolean).join(','));
    const res = await query;
    if (res.error) throw res.error;
    // Also match customers by event name when searching
    let rows = res.data as any[];
    if (t && page === 0) {
      const ev = must(await sb.from('events').select('customer_id,customers(id,name,phone,whatsapp,created_at)').eq('business_id', business.id).ilike('name', `%${t}%`).limit(10)) as any[];
      for (const e of ev) if (e.customers && !rows.some((r) => r.id === e.customers.id)) rows = [...rows, e.customers];
    }
    return { rows, count: res.count ?? rows.length };
  }, [business.id, q, page]);

  return (
    <div className="space-y-5">
      <PageHeader title="Customers" subtitle="The people you serve" action={<Link href="/app/customers/new"><Button size="sm"><Plus className="h-4 w-4" /> Add</Button></Link>} />
      <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} type="search" aria-label="Search customers" placeholder="Search by name, phone or event"
        className="min-h-[52px] w-full rounded-2xl border border-charcoal-100 bg-white px-4 text-[16px] shadow-card focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/20" />
      {loading ? <ListSkeleton /> : error ? <ErrorBox message={error} onRetry={reload} /> : data && (
        data.rows.length === 0
          ? <EmptyState emoji="🤝" title={q ? 'No customers match that search' : 'No customers yet. Let’s add your first one.'} action={!q ? <Link href="/app/customers/new"><Button>Add Customer</Button></Link> : undefined} />
          : <>
              <div className="space-y-2">
                {data.rows.map((c) => (
                  <Link key={c.id} href={`/app/customers/${c.id}`} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-card">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-burgundy-50 font-display text-xl text-burgundy">{c.name[0]?.toUpperCase()}</div>
                    <div className="min-w-0"><p className="truncate font-semibold">{c.name}</p><p className="truncate text-sm text-charcoal-300">{c.phone || c.whatsapp || 'No phone added'}</p></div>
                  </Link>
                ))}
              </div>
              {data.count > PAGE && (
                <div className="flex items-center justify-between">
                  <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                  <span className="text-sm text-charcoal-300">Page {page + 1} of {Math.ceil(data.count / PAGE)}</span>
                  <Button variant="secondary" size="sm" disabled={(page + 1) * PAGE >= data.count} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              )}
            </>
      )}
    </div>
  );
}

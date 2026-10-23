'use client';
import { useState } from 'react';
import { useBusiness } from '@/components/BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must, useQuery } from '@/lib/useQuery';
import { AddTaskButton, TaskRows } from '@/components/TaskList';
import { Card, EmptyState, ErrorBox, ListSkeleton, PageHeader, cx, useToast } from '@/components/ui';

export default function Tasks() {
  const { business } = useBusiness();
  const { toast, node } = useToast();
  const [show, setShow] = useState<'open' | 'done'>('open');
  const { data, loading, error, reload } = useQuery(async () => {
    const q = supabaseBrowser().from('tasks').select('*, events(name)').eq('business_id', business.id).limit(200);
    const res = show === 'open' ? await q.neq('status', 'done').order('due_date', { ascending: true, nullsFirst: false }) : await q.eq('status', 'done').order('created_at', { ascending: false });
    return must(res) as any[];
  }, [business.id, show]);
  return (
    <div className="space-y-5">{node}
      <PageHeader title="Tasks" subtitle="Things to do across your events" action={<AddTaskButton businessId={business.id} onSaved={reload} />} />
      <div className="flex gap-2">{(['open', 'done'] as const).map((s) => <button key={s} onClick={() => setShow(s)} aria-pressed={show === s} className={cx('min-h-[44px] flex-1 rounded-full border text-sm font-semibold', show === s ? 'border-burgundy bg-burgundy text-white' : 'border-charcoal-100 bg-white')}>{s === 'open' ? 'To do' : 'Done'}</button>)}</div>
      {loading ? <ListSkeleton /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data || data.length === 0
        ? <EmptyState emoji="✅" title={show === 'open' ? 'All caught up' : 'Nothing completed yet'} body={show === 'open' ? 'No open tasks. Add one when something comes up.' : undefined} />
        : <Card><TaskRows tasks={data} showEvent onChanged={reload} toast={toast} /></Card>}
    </div>
  );
}

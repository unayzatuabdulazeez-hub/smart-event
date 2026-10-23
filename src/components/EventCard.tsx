import Link from 'next/link';
import { Users } from 'lucide-react';
import { formatShort, daysUntil } from '@/lib/dates';
import { formatNaira } from '@/lib/money';
import { PAYMENT_LABEL, statusLabel } from '@/lib/status';
import { Badge, statusTone } from './ui';

export interface EventListItem {
  id: string; name: string; event_date: string; guest_count: number; status: string; event_type: string;
  customer_name?: string; total?: number; balance?: number; payment_status?: string; booking_number?: string | null;
}

export default function EventCard({ e, payMode = false }: { e: EventListItem; payMode?: boolean }) {
  const d = daysUntil(e.event_date);
  const when = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d > 1 && d <= 14 ? `In ${d} days` : null;
  return (
    <Link href={`/app/events/${e.id}${payMode ? '?pay=1' : ''}`} className="flex gap-4 rounded-2xl border border-cream-300/60 bg-white p-4 shadow-card transition hover:border-burgundy/30">
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-burgundy-50 text-burgundy">
        <div className="text-center leading-tight">
          <div className="text-xl font-bold">{new Date(e.event_date + 'T00:00:00Z').getUTCDate()}</div>
          <div className="text-[11px] font-semibold uppercase">{formatShort(e.event_date).split(' ')[1]}</div>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{e.name}</p>
        <p className="truncate text-sm text-charcoal-300">{e.customer_name ? `${e.customer_name} · ` : ''}{e.event_type}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(e.status)}>{statusLabel(e.status)}</Badge>
          {e.payment_status && e.status !== 'cancelled' && <Badge tone={statusTone(e.payment_status)}>{PAYMENT_LABEL[e.payment_status]}</Badge>}
          {when && <Badge tone="warn">{when}</Badge>}
          <span className="inline-flex items-center gap-1 text-xs text-charcoal-300"><Users className="h-3.5 w-3.5" />{e.guest_count}</span>
        </div>
      </div>
      {e.balance !== undefined && e.balance > 0 && e.status !== 'cancelled' && (
        <div className="hidden text-right sm:block">
          <p className="text-xs text-charcoal-300">Balance</p>
          <p className="font-semibold text-coral-600">{formatNaira(e.balance)}</p>
        </div>
      )}
    </Link>
  );
}

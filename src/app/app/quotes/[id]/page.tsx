'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { MessageCircle, Pencil, Printer, Trash2 } from 'lucide-react';
import { useBusiness } from '@/components/BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must, useQuery } from '@/lib/useQuery';
import { friendlyError } from '@/lib/errors';
import { formatDate, todayStr } from '@/lib/dates';
import { formatNaira, grandTotal, subtotal } from '@/lib/money';
import { templates } from '@/lib/whatsapp';
import { Badge, Button, EmptyState, ErrorBox, ListSkeleton, Modal, SelectField, statusTone, useToast } from '@/components/ui';
import WhatsAppDialog from '@/components/WhatsAppDialog';

const LABEL: Record<string, string> = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined', expired: 'Expired' };

export default function QuoteView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { business } = useBusiness();
  const { toast, node } = useToast();
  const sb = supabaseBrowser();
  const [wa, setWa] = useState(false);
  const [del, setDel] = useState(false);

  const { data, loading, error, reload } = useQuery(async () => {
    const q = must(await sb.from('quotes').select('*, customers(name, phone, whatsapp, email, address), events(name, event_date, venue, guest_count)').eq('id', id).eq('business_id', business.id).maybeSingle()) as any;
    if (!q) return null;
    const items = must(await sb.from('quote_items').select('*').eq('quote_id', id).order('sort')) as any[];
    return { q, items };
  }, [id, business.id]);

  if (loading && !data) return <ListSkeleton rows={4} />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <EmptyState emoji="📄" title="Quote not found" action={<Link href="/app/quotes"><Button variant="secondary">Back to quotes</Button></Link>} />;

  const { q, items } = data;
  const nums = items.map((i: any) => ({ quantity: Number(i.quantity), unit_price: Number(i.unit_price) }));
  const sub = subtotal(nums);
  const total = grandTotal(nums, { discount: Number(q.discount), additional_charges: Number(q.additional_charges) });
  const deposit = Number(q.deposit_required);
  const lapsed = q.expiry_date && q.expiry_date < todayStr() && ['draft', 'sent'].includes(q.status);
  const shownStatus = lapsed ? 'expired' : q.status;
  const brand = business.primary_color;
  const first = q.customers?.name?.split(' ')[0] ?? '';

  async function setStatus(status: string) {
    const { error } = await sb.from('quotes').update({ status }).eq('id', q.id);
    if (error) { toast.err(friendlyError(error, 'Unable to update the quote.')); return; }
    if (q.event_id) {
      if (status === 'accepted') await sb.from('events').update({ status: 'confirmed' }).eq('id', q.event_id).in('status', ['inquiry', 'quote_sent', 'awaiting_approval']);
      if (status === 'sent') await sb.from('events').update({ status: 'quote_sent' }).eq('id', q.event_id).eq('status', 'inquiry');
    }
    toast.ok(`Quote marked ${LABEL[status].toLowerCase()}`); reload();
  }
  async function remove() {
    const { error } = await sb.from('quotes').delete().eq('id', q.id);
    if (error) { toast.err(friendlyError(error, 'Unable to delete the quote.')); return; }
    router.replace('/app/quotes');
  }

  return (
    <div className="space-y-5">
      {node}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/quotes" className="text-sm font-semibold text-burgundy">← All quotes</Link>
        <Badge tone={statusTone(shownStatus)}>{LABEL[shownStatus]}</Badge>
      </div>
      <div className="no-print grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button variant="whatsapp" onClick={() => setWa(true)}><MessageCircle className="h-4 w-4" /> Send on WhatsApp</Button>
        <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / PDF</Button>
        <Link href={`/app/quotes/${q.id}/edit`} className="contents"><Button variant="secondary"><Pencil className="h-4 w-4" /> Edit</Button></Link>
        <Button variant="ghost" onClick={() => setDel(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
      </div>
      <div className="no-print max-w-xs"><SelectField label="Quote status" value={q.status} onChange={(e) => setStatus(e.target.value)}>
        {Object.entries(LABEL).filter(([k]) => k !== 'expired').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectField></div>

      {/* The document itself */}
      <article className="overflow-hidden rounded-2xl border border-cream-300 bg-white shadow-card print:rounded-none print:border-0 print:shadow-none" aria-label="Quotation">
        <div className="h-2" style={{ background: brand }} />
        <div className="space-y-6 p-6 sm:p-8">
          <header className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {business.logo_url && <img src={business.logo_url} alt="" className="h-14 w-14 rounded-full object-cover" />}
              <div><p className="font-display text-2xl" style={{ color: brand }}>{business.name}</p>
                <p className="text-xs text-charcoal-300">{[business.phone, business.email, business.location].filter(Boolean).join(' · ')}</p></div>
            </div>
            <div className="text-right"><p className="font-display text-3xl tracking-wide">QUOTATION</p><p className="text-sm text-charcoal-300">{q.quote_number}</p></div>
          </header>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-charcoal-300">Prepared for</p><p className="font-semibold">{q.customers?.name}</p>
              <p className="text-charcoal-300">{[q.customers?.phone, q.customers?.email].filter(Boolean).join(' · ')}</p></div>
            <div className="sm:text-right"><p><span className="text-charcoal-300">Issued: </span>{formatDate(q.issue_date)}</p>{q.expiry_date && <p><span className="text-charcoal-300">Valid until: </span>{formatDate(q.expiry_date)}</p>}</div>
          </div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-charcoal-300">Event</p><p className="font-display text-2xl">{q.title}</p>
            {q.events && <p className="text-sm text-charcoal-300">{formatDate(q.events.event_date)}{q.events.venue ? ` · ${q.events.venue}` : ''}{q.events.guest_count ? ` · ${q.events.guest_count} guests` : ''}</p>}</div>
          <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
            <thead><tr className="border-b-2 text-left text-xs uppercase tracking-wide text-charcoal-300" style={{ borderColor: brand }}><th className="py-2">Service</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Unit price</th><th className="py-2 text-right">Amount</th></tr></thead>
            <tbody>{items.map((i: any) => (
              <tr key={i.id} className="border-b border-cream-200 align-top"><td className="py-3"><p className="font-semibold">{i.service}</p>{i.description && <p className="text-xs text-charcoal-300">{i.description}</p>}</td>
                <td className="py-3 text-right">{Number(i.quantity)}</td><td className="py-3 text-right">{formatNaira(i.unit_price)}</td><td className="py-3 text-right font-semibold">{formatNaira(Number(i.quantity) * Number(i.unit_price))}</td></tr>))}</tbody></table></div>
          <dl className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatNaira(sub)}</dd></div>
            {Number(q.discount) > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>-{formatNaira(q.discount)}</dd></div>}
            {Number(q.additional_charges) > 0 && <div className="flex justify-between"><dt>Additional charges</dt><dd>{formatNaira(q.additional_charges)}</dd></div>}
            <div className="flex justify-between border-t-2 pt-2 font-display text-2xl" style={{ borderColor: brand }}><dt>Total</dt><dd style={{ color: brand }}>{formatNaira(total)}</dd></div>
            {deposit > 0 && <><div className="flex justify-between"><dt>Deposit required</dt><dd className="font-semibold">{formatNaira(deposit)}</dd></div><div className="flex justify-between"><dt>Balance after deposit</dt><dd>{formatNaira(Math.max(total - deposit, 0))}</dd></div></>}
          </dl>
          {q.notes && <p className="rounded-xl bg-cream-100 p-4 text-sm">{q.notes}</p>}
          {q.terms && <div><p className="text-xs font-semibold uppercase tracking-wide text-charcoal-300">Terms and conditions</p><p className="mt-1 whitespace-pre-line text-xs text-charcoal-400">{q.terms}</p></div>}
          <p className="border-t border-cream-200 pt-4 text-center text-xs text-charcoal-200">Thank you for choosing {business.name} · Powered by Unaabs Smart Business</p>
        </div>
      </article>

      <WhatsAppDialog open={wa} onClose={() => setWa(false)} title="Send quote on WhatsApp" phone={q.customers?.whatsapp || q.customers?.phone}
        message={templates.quote({ customer: first, business: business.name, event: q.title, total, paid: 0, balance: total, quoteNumber: q.quote_number })
          + (deposit > 0 ? `\nDeposit to confirm: ₦${deposit.toLocaleString('en-NG')}` : '') + (q.expiry_date ? `\nValid until ${formatDate(q.expiry_date)}` : '')}
        onOpened={() => { if (q.status === 'draft') setStatus('sent'); }} />
      <Modal open={del} onClose={() => setDel(false)} title="Delete this quote?"><p className="text-sm text-charcoal-300">This cannot be undone.</p>
        <div className="mt-4 flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => setDel(false)}>Keep</Button><Button variant="danger" className="flex-1" onClick={remove}>Delete</Button></div></Modal>
    </div>
  );
}

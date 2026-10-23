'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { addDaysStr, todayStr, formatShort } from '@/lib/dates';
import { templates, type MsgCtx } from '@/lib/whatsapp';
import { Button, Card, SectionTitle } from '../ui';
import WhatsAppDialog from '../WhatsAppDialog';

const ACTIONS = [
  ['thanks', 'Thank Customer'], ['feedback', 'Request Feedback'], ['review', 'Request Review'], ['photos', 'Ask to Share Photos'], ['followUp', 'Follow Up'],
] as const;

export default function RetentionPanel({ businessId, eventId, customerId, phone, ctx, followUps, onChanged, toast }: {
  businessId: string; eventId: string; customerId: string; phone: string | null; ctx: MsgCtx;
  followUps: { id: string; kind: string; due_date: string; done: boolean }[]; onChanged: () => void; toast: { ok: (s: string) => void; err: (s: string) => void };
}) {
  const [which, setWhich] = useState<(typeof ACTIONS)[number] | null>(null);
  async function schedule(days: number) {
    const { error } = await supabaseBrowser().from('follow_ups').insert({ business_id: businessId, event_id: eventId, customer_id: customerId, kind: 'follow_up', due_date: addDaysStr(todayStr(), days) });
    if (error) toast.err(friendlyError(error, 'Unable to set the reminder.')); else { toast.ok(`Reminder set for ${days} days from now`); onChanged(); }
  }
  return (
    <section id="retention">
      <SectionTitle>After the event</SectionTitle>
      <Card className="space-y-4">
        <p className="text-sm text-charcoal-300">Nothing is sent automatically. You choose what to send and when.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ACTIONS.map((a) => <Button key={a[0]} variant="secondary" onClick={() => setWhich(a)}>{a[1]}</Button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">Remind me to follow up:</span>
          <Button size="sm" variant="ghost" onClick={() => schedule(7)}>in 7 days</Button><Button size="sm" variant="ghost" onClick={() => schedule(30)}>in 30 days</Button></div>
        {followUps.filter((f) => !f.done).map((f) => <p key={f.id} className="text-sm text-charcoal-300">⏰ Follow-up on {formatShort(f.due_date)}</p>)}
      </Card>
      <WhatsAppDialog open={!!which} onClose={() => setWhich(null)} title={which?.[1] ?? ''} phone={phone} message={which ? templates[which[0]](ctx) : ''} />
    </section>
  );
}

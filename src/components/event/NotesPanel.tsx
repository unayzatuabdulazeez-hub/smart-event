'use client';
import { useState } from 'react';
import { Eye, Lock } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import type { EventRow } from '@/lib/types';
import { Button, Card, SectionTitle, TextArea, TextField, Toggle } from '../ui';
import ImagePicker from '../ImagePicker';

export default function NotesPanel({ event, onChanged, toast }: { event: EventRow; onChanged: () => void; toast: { ok: (s: string) => void; err: (s: string) => void } }) {
  const [f, setF] = useState({
    internal: event.internal_notes ?? '', customer: event.customer_notes ?? '', nextStep: event.next_step ?? '', nextDue: event.next_step_due ?? '',
    show_event_details: event.show_event_details, show_services: event.show_services, show_progress: event.show_progress,
    show_payment: event.show_payment, show_venue: event.show_venue, show_notes: event.show_notes,
  });
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<string | null>(event.cover_image_url);
  async function save() {
    setBusy(true);
    const { error } = await supabaseBrowser().from('events').update({
      internal_notes: f.internal.trim() || null, customer_notes: f.customer.trim() || null, next_step: f.nextStep.trim() || null, next_step_due: f.nextDue || null,
      show_event_details: f.show_event_details, show_services: f.show_services, show_progress: f.show_progress, show_payment: f.show_payment, show_venue: f.show_venue, show_notes: f.show_notes,
    }).eq('id', event.id);
    setBusy(false);
    if (error) toast.err(friendlyError(error, 'Unable to save notes.')); else { toast.ok('Saved'); onChanged(); }
  }
  return (
    <section id="notes" className="space-y-4">
      <SectionTitle>Notes &amp; what your customer sees</SectionTitle>
      <Card className="space-y-4 border-charcoal-100 bg-cream-50">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Lock className="h-4 w-4" /> Private notes (never shown to the customer)</p>
        <TextArea label="Internal notes" aria-label="Internal notes" value={f.internal} onChange={(e) => setF({ ...f, internal: e.target.value })} placeholder="e.g. Customer changed guest count. Vendor wants payment before Friday." />
      </Card>
      <Card className="space-y-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Eye className="h-4 w-4" /> Shared with your customer on their portal</p>
        <TextArea label="Customer-visible note" value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} placeholder="e.g. Final menu confirmation is required before 10 October." />
        <ImagePicker label="Event image (shown on the customer's portal)" bucket="event-images" businessId={event.business_id} value={image} shape="wide"
          onChange={async (url) => {
            const { error } = await supabaseBrowser().from('events').update({ cover_image_url: url }).eq('id', event.id);
            if (error) toast.err(friendlyError(error, 'Unable to save the image.')); else { setImage(url); toast.ok('Image saved'); onChanged(); }
          }} />
        <TextField label="Next step for the customer" value={f.nextStep} onChange={(e) => setF({ ...f, nextStep: e.target.value })} placeholder="e.g. Final guest count" />
        <TextField label="Next step due date" type="date" value={f.nextDue} onChange={(e) => setF({ ...f, nextDue: e.target.value })} />
        <div className="divide-y divide-cream-200 rounded-2xl bg-cream-100 px-4">
          <Toggle label="Event details (date, time, guests)" checked={f.show_event_details} onChange={(v) => setF({ ...f, show_event_details: v })} />
          <Toggle label="Venue" checked={f.show_venue} onChange={(v) => setF({ ...f, show_venue: v })} />
          <Toggle label="Services booked" checked={f.show_services} onChange={(v) => setF({ ...f, show_services: v })} />
          <Toggle label="Event journey / progress" checked={f.show_progress} onChange={(v) => setF({ ...f, show_progress: v })} />
          <Toggle label="Payment summary (total, paid, balance)" checked={f.show_payment} onChange={(v) => setF({ ...f, show_payment: v })} />
          <Toggle label="Customer-visible note" checked={f.show_notes} onChange={(v) => setF({ ...f, show_notes: v })} />
        </div>
        <p className="text-xs text-charcoal-300">Vendor costs, expenses, profit and private notes are never shown, whatever you choose here.</p>
      </Card>
      <Button className="w-full" loading={busy} loadingText="Saving..." onClick={save}>Save notes &amp; visibility</Button>
    </section>
  );
}

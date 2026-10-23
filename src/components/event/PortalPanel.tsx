'use client';
import { useState } from 'react';
import { Copy, ExternalLink, Link2, MessageCircle, ShieldOff } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { defaultExpiry, generatePortalToken, hashPortalToken } from '@/lib/portal-token';
import { formatDate } from '@/lib/dates';
import { templates } from '@/lib/whatsapp';
import type { Portal } from '@/lib/types';
import { Badge, Button, Card, ErrorBox, SectionTitle, SelectField } from '../ui';
import WhatsAppDialog from '../WhatsAppDialog';

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || (typeof location !== 'undefined' ? location.origin : '')).replace(/\/$/, '');

export default function PortalPanel({ businessId, eventId, customerId, customerName, customerPhone, businessName, eventName, portals, onChanged, toast }: {
  businessId: string; eventId: string; customerId: string; customerName: string; customerPhone: string | null; businessName: string; eventName: string;
  portals: Portal[]; onChanged: () => void; toast: { ok: (s: string) => void; err: (s: string) => void };
}) {
  // The raw token exists only here, in memory, right after generation. The database keeps only its SHA-256 hash.
  const [fresh, setFresh] = useState<{ url: string; id: string } | null>(null);
  const [days, setDays] = useState('90');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wa, setWa] = useState(false);
  const now = Date.now();
  const isActive = (p: Portal) => !p.revoked_at && new Date(p.expires_at).getTime() > now;
  const active = portals.filter(isActive);

  async function generate() {
    setBusy(true); setErr(null);
    try {
      const sb = supabaseBrowser();
      if (active.length) {
        const r = await sb.from('customer_portals').update({ revoked_at: new Date().toISOString() }).in('id', active.map((p) => p.id));
        if (r.error) throw r.error;
      }
      const token = generatePortalToken();
      const ins = await sb.from('customer_portals').insert({
        business_id: businessId, event_id: eventId, customer_id: customerId,
        token_hash: await hashPortalToken(token), expires_at: defaultExpiry(new Date(), Number(days)).toISOString(),
      }).select('id').single();
      if (ins.error) throw ins.error;
      setFresh({ url: `${appUrl()}/portal/${token}`, id: ins.data.id as string });
      toast.ok('Portal link created'); onChanged();
    } catch (e) { setErr(friendlyError(e, 'Unable to create the portal link.')); } finally { setBusy(false); }
  }
  async function revoke(p: Portal) {
    const { error } = await supabaseBrowser().from('customer_portals').update({ revoked_at: new Date().toISOString() }).eq('id', p.id);
    if (error) { toast.err(friendlyError(error, 'Unable to revoke the link.')); return; }
    if (fresh?.id === p.id) setFresh(null);
    toast.ok('Link revoked. It can no longer be opened.'); onChanged();
  }
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); toast.ok('Link copied'); } catch { toast.err('Could not copy automatically. Select the link and copy it.'); }
  }
  const stateOf = (p: Portal) => p.revoked_at ? ['bad', 'Revoked'] : new Date(p.expires_at).getTime() <= now ? ['warn', 'Expired'] : ['good', 'Active'];

  return (
    <section id="portal">
      <SectionTitle>Customer portal</SectionTitle>
      <Card className="space-y-4">
        <p className="text-sm text-charcoal-300">A private page for {customerName.split(' ')[0]} with the event journey, details and (if you allow it) payment summary. No account needed.</p>
        {fresh && (
          <div className="space-y-3 rounded-2xl border border-emerald/30 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-700">Your new link is ready. Copy it now: for security it cannot be shown again after you leave this page.</p>
            <p className="break-all rounded-xl bg-white p-3 text-xs" data-testid="portal-url">{fresh.url}</p>
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" variant="secondary" onClick={() => copy(fresh.url)}><Copy className="h-4 w-4" /> Copy</Button>
              <a href={fresh.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-charcoal-100 bg-white px-3.5 text-sm font-semibold hover:bg-cream-200"><ExternalLink className="h-4 w-4" /> Open</a>
              <Button size="sm" variant="whatsapp" onClick={() => setWa(true)}><MessageCircle className="h-4 w-4" /> Send</Button>
            </div>
          </div>
        )}
        {portals.length === 0 ? <p className="text-sm text-charcoal-300">No portal link yet. Create one to share this event with your customer.</p> : (
          <div className="divide-y divide-cream-200">
            {portals.map((p) => {
              const [tone, label] = stateOf(p);
              return (
                <div key={p.id} className="space-y-1 py-3 text-sm">
                  <div className="flex items-center justify-between"><Badge tone={tone}>{label}</Badge>
                    {isActive(p) && <Button size="sm" variant="ghost" onClick={() => revoke(p)}><ShieldOff className="h-4 w-4" /> Revoke</Button>}</div>
                  <p className="text-charcoal-300">Created {formatDate(p.created_at.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })} · Expires {formatDate(p.expires_at.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  <p className="text-charcoal-300">Last opened: {p.last_accessed_at ? formatDate(p.last_accessed_at.slice(0, 10), { day: 'numeric', month: 'short' }) : 'not yet'} · Opened {p.access_count} time{p.access_count === 1 ? '' : 's'}</p>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="sm:w-44"><SelectField label="Link valid for" value={days} onChange={(e) => setDays(e.target.value)}><option value="30">30 days</option><option value="90">90 days</option><option value="180">180 days</option></SelectField></div>
          <Button className="flex-1" loading={busy} loadingText="Generating..." onClick={generate}><Link2 className="h-4 w-4" /> {active.length ? 'Generate new link (replaces current)' : 'Create portal link'}</Button>
        </div>
        {err && <ErrorBox message={err} />}
      </Card>
      <WhatsAppDialog open={wa} onClose={() => setWa(false)} title="Send portal link" phone={customerPhone}
        message={templates.portal({ customer: customerName.split(' ')[0], business: businessName, event: eventName, total: 0, paid: 0, balance: 0, portalUrl: fresh?.url })} />
    </section>
  );
}

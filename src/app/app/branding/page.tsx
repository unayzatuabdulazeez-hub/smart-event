'use client';
import { useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { useBusiness } from '@/components/BusinessProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/upload';
import { friendlyError } from '@/lib/errors';
import { contrast, readableOn, safeColor } from '@/lib/color';
import { optionalEmailError, optionalPhoneError } from '@/lib/validation';
import { BUSINESS_TYPES } from '@/lib/status';
import { Button, Card, ErrorBox, PageHeader, PoweredBy, SelectField, TextArea, TextField, useToast } from '@/components/ui';

const PALETTE = ['#7A1F3D', '#0F7B5F', '#C9962B', '#E8735A', '#2B2523', '#4B2E83'];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export default function Branding() {
  const { business, refresh } = useBusiness();
  const { toast, node } = useToast();
  const [f, setF] = useState({
    name: business.name, type: business.business_type, phone: business.phone ?? '', whatsapp: business.whatsapp ?? '', email: business.email ?? '', location: business.location ?? '',
    description: business.description ?? '', welcome: business.welcome_message ?? '', primary: business.primary_color, secondary: business.secondary_color, slug: business.slug,
  });
  const [logo, setLogo] = useState(business.logo_url);
  const [cover, setCover] = useState(business.cover_url);
  const [up, setUp] = useState<null | 'logo' | 'cover'>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function pick(kind: 'logo' | 'cover', file: File | undefined) {
    if (!file) return;
    setUp(kind); setErr(null);
    try {
      const url = await uploadImage('branding', business.id, file);
      // Saved straight away so the image is never "lost" if the owner leaves without pressing Save.
      const { error } = await supabaseBrowser().from('businesses').update(kind === 'logo' ? { logo_url: url } : { cover_url: url }).eq('id', business.id);
      if (error) throw error;
      kind === 'logo' ? setLogo(url) : setCover(url);
      toast.ok(kind === 'logo' ? 'Logo updated' : 'Cover image updated'); refresh();
    } catch (e) { setErr(e instanceof Error && e.message.startsWith('Please') || (e instanceof Error && e.message.includes('too large')) || (e instanceof Error && e.message.includes('upload failed')) ? (e as Error).message : friendlyError(e, 'Image upload failed. Please try again.')); }
    finally { setUp(null); }
  }
  async function removeImage(kind: 'logo' | 'cover') {
    const { error } = await supabaseBrowser().from('businesses').update(kind === 'logo' ? { logo_url: null } : { cover_url: null }).eq('id', business.id);
    if (error) { toast.err(friendlyError(error)); return; }
    kind === 'logo' ? setLogo(null) : setCover(null); refresh();
  }
  async function save() {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = 'Enter your business name.';
    const p = optionalPhoneError(f.phone); if (p) e.phone = p;
    const w = optionalPhoneError(f.whatsapp); if (w) e.whatsapp = w;
    const m = optionalEmailError(f.email); if (m) e.email = m;
    if (!SLUG.test(f.slug)) e.slug = 'Use lowercase letters, numbers and dashes only, e.g. aisha-events.';
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true); setErr(null);
    const { error } = await supabaseBrowser().from('businesses').update({
      name: f.name.trim(), business_type: f.type, phone: f.phone.trim() || null, whatsapp: f.whatsapp.trim() || null, email: f.email.trim() || null, location: f.location.trim() || null,
      description: f.description.trim() || null, welcome_message: f.welcome.trim() || null, primary_color: f.primary, secondary_color: f.secondary, slug: f.slug,
    }).eq('id', business.id);
    setBusy(false);
    if (error) { if (error.code === '23505') setErrs({ slug: 'That web address is taken. Try another.' }); else setErr(friendlyError(error, 'Unable to save your changes.')); return; }
    toast.ok('Saved. Your customers will see the changes straight away.'); refresh();
  }

  const primary = safeColor(f.primary, '#7A1F3D');
  const lowContrast = contrast(primary, '#FFFFFF') < 3 && contrast(primary, '#2B2523') < 3;
  return (
    <div className="space-y-5">{node}
      <PageHeader title="Branding & profile" subtitle="This is how customers see your business" />
      <Card className="overflow-hidden p-0" aria-label="Preview of your customer page">
        <div className="relative p-5" style={{ background: primary, color: readableOn(primary) }}>
          {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
          <div className="relative">
            <div className="flex items-center gap-3">{logo ? <img src={logo} alt="" className="h-12 w-12 rounded-full bg-white object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-full bg-white/20 font-display text-xl">{f.name[0]}</div>}<p className="text-sm font-semibold uppercase tracking-widest">{f.name || 'Your business'}</p></div>
            <p className="mt-6 text-xs uppercase tracking-widest opacity-80">Welcome, Maryam ❤️</p><p className="font-display text-2xl">Maryam &amp; Ahmed’s Wedding</p>
            <p className="mt-2 text-sm opacity-90">{f.welcome || `Thank you for choosing ${f.name || 'us'}.`}</p>
          </div>
        </div>
        <div className="h-2" style={{ background: `repeating-linear-gradient(90deg, ${safeColor(f.secondary, '#0F7B5F')} 0 14px, #C9962B 14px 22px)` }} />
        <p className="bg-cream-100 p-2 text-center text-xs text-charcoal-300">Preview</p>
      </Card>
      <Card className="space-y-4">
        <h2 className="font-display text-xl">Images</h2>
        {(['logo', 'cover'] as const).map((k) => {
          const url = k === 'logo' ? logo : cover;
          return (
            <div key={k} className="flex items-center gap-3">
              {url ? <img src={url} alt={`Current ${k}`} className="h-16 w-16 rounded-xl object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-xl bg-cream-200 text-charcoal-200"><ImagePlus className="h-6 w-6" /></div>}
              <div className="flex-1"><p className="font-semibold">{k === 'logo' ? 'Logo' : 'Cover image'}</p><p className="text-xs text-charcoal-300">JPG, PNG or WebP, under 3 MB</p></div>
              <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-charcoal-100 bg-white px-4 text-sm font-semibold hover:bg-cream-200">
                {up === k ? 'Uploading...' : url ? 'Change' : 'Upload'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={up !== null} onChange={(e) => { pick(k, e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              {url && <Button size="sm" variant="ghost" onClick={() => removeImage(k)}>Remove</Button>}
            </div>);
        })}
      </Card>
      <Card className="space-y-4">
        <h2 className="font-display text-xl">Colours</h2>
        {(['primary', 'secondary'] as const).map((k) => (
          <fieldset key={k}><legend className="mb-2 text-sm font-semibold text-charcoal-400">{k === 'primary' ? 'Primary colour' : 'Secondary colour'}</legend>
            <div className="flex flex-wrap items-center gap-2">{PALETTE.map((c) => <button key={c} type="button" aria-label={`${k} ${c}`} aria-pressed={f[k] === c} onClick={() => set(k, c)} style={{ background: c }} className={`h-11 w-11 rounded-full border-2 ${f[k] === c ? 'border-charcoal ring-2 ring-gold' : 'border-white'}`} />)}
              <input type="color" aria-label={`Custom ${k} colour`} value={safeColor(f[k], '#7A1F3D')} onChange={(e) => set(k, e.target.value.toUpperCase())} className="h-11 w-14 cursor-pointer rounded-lg border border-charcoal-100" /></div></fieldset>))}
        {lowContrast && <p role="status" className="rounded-xl bg-gold-50 p-3 text-sm text-gold-600">This colour is hard to read against both light and dark text. A deeper or lighter shade will look better.</p>}
      </Card>
      <Card className="space-y-4">
        <h2 className="font-display text-xl">Business details</h2>
        <TextField label="Business name" value={f.name} onChange={(e) => set('name', e.target.value)} error={errs.name} />
        <SelectField label="Business type" value={f.type} onChange={(e) => set('type', e.target.value)}>{BUSINESS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</SelectField>
        <TextField label="Phone" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} error={errs.phone} />
        <TextField label="WhatsApp" inputMode="tel" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} error={errs.whatsapp} />
        <TextField label="Email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} error={errs.email} />
        <TextField label="Location" value={f.location} onChange={(e) => set('location', e.target.value)} />
        <TextArea label="Description" value={f.description} onChange={(e) => set('description', e.target.value)} />
        <TextArea label="Welcome message for customers" value={f.welcome} onChange={(e) => set('welcome', e.target.value)} />
        <TextField label="Your public web address" value={f.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} error={errs.slug} hint={`/business/${f.slug || 'your-name'}`} />
      </Card>
      {err && <ErrorBox message={err} />}
      <Button className="w-full" loading={busy} loadingText="Saving..." onClick={save}>Save changes</Button>
      <PoweredBy />
    </div>
  );
}

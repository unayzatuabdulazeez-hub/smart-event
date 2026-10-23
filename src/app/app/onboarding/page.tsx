'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { optionalEmailError, optionalPhoneError } from '@/lib/validation';
import { BUSINESS_TYPES, SERVICE_OPTIONS } from '@/lib/status';
import { Button, Card, ErrorBox, SelectField, TextArea, TextField, cx } from '@/components/ui';

const PALETTE = ['#7A1F3D', '#0F7B5F', '#C9962B', '#E8735A', '#2B2523', '#4B2E83'];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    name: '', type: 'multiple', phone: '', whatsapp: '', email: '', location: '',
    primary: '#7A1F3D', secondary: '#0F7B5F', description: '', welcome: '', services: [] as string[],
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  function validateStep(s: number) {
    const e: Record<string, string> = {};
    if (s === 0 && f.name.trim().length < 2) e.name = 'Enter your business name.';
    if (s === 1) {
      const p = optionalPhoneError(f.phone); if (p) e.phone = p;
      const w = optionalPhoneError(f.whatsapp); if (w) e.whatsapp = w;
      const m = optionalEmailError(f.email); if (m) e.email = m;
      if (!f.phone.trim() && !f.whatsapp.trim()) e.phone = 'Add a phone or WhatsApp number so customers can reach you.';
    }
    setErrs(e);
    return Object.keys(e).length === 0;
  }

  async function finish() {
    if (!validateStep(1)) { setStep(1); return; }
    setBusy(true); setError(null);
    try {
      const sb = supabaseBrowser();
      const welcome = f.welcome.trim() || `Thank you for choosing ${f.name.trim()}. We are excited to make your occasion special.`;
      const { error } = await sb.rpc('create_business', {
        p_name: f.name, p_type: f.type, p_phone: f.phone || null, p_whatsapp: f.whatsapp || f.phone || null,
        p_email: f.email || null, p_location: f.location || null, p_primary: f.primary, p_secondary: f.secondary,
        p_description: f.description || null, p_welcome: welcome, p_services: f.services,
      });
      if (error) {
        if (error.message.includes('BUSINESS_EXISTS')) { router.replace('/app'); return; }
        throw error;
      }
      router.replace('/app');
      router.refresh();
    } catch (e) { setError(friendlyError(e, 'Unable to set up your business. Please try again.')); }
    finally { setBusy(false); }
  }

  const steps = ['Your business', 'Contact', 'Look & feel'];
  return (
    <main className="min-h-screen bg-cream-100">
      <div className="kente" />
      <div className="mx-auto max-w-lg px-5 py-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-600">Unaabs Smart Events</p>
        <h1 className="mt-2 font-display text-3xl">Let’s set up your business</h1>
        <ol className="mt-5 flex gap-2" aria-label="Progress">
          {steps.map((s, i) => (
            <li key={s} className={cx('flex-1 rounded-full px-3 py-2 text-center text-xs font-semibold', i === step ? 'bg-burgundy text-white' : i < step ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-charcoal-300')}>
              {i < step ? '✓ ' : ''}{s}
            </li>
          ))}
        </ol>
        <Card className="mt-5 space-y-4">
          {step === 0 && (<>
            <TextField label="Business name" placeholder="Aisha Events" value={f.name} onChange={(e) => set('name', e.target.value)} error={errs.name} />
            <SelectField label="What does your business do?" value={f.type} onChange={(e) => set('type', e.target.value)}>
              {BUSINESS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </SelectField>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-charcoal-400">Services you offer</legend>
              <div className="flex flex-wrap gap-2">
                {SERVICE_OPTIONS.map((s) => {
                  const on = f.services.includes(s);
                  return (
                    <button type="button" key={s} aria-pressed={on}
                      onClick={() => setF((p) => ({ ...p, services: on ? p.services.filter((x) => x !== s) : [...p.services, s] }))}
                      className={cx('min-h-[44px] rounded-full border px-4 text-sm font-semibold', on ? 'border-emerald bg-emerald-50 text-emerald-700' : 'border-charcoal-100 bg-white')}>
                      {on ? '✓ ' : ''}{s}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <TextArea label="Short description" placeholder="Premium catering and small-chops services for weddings and special occasions." value={f.description} onChange={(e) => set('description', e.target.value)} />
          </>)}
          {step === 1 && (<>
            <TextField label="Phone number" inputMode="tel" placeholder="0803 123 4567" value={f.phone} onChange={(e) => set('phone', e.target.value)} error={errs.phone} />
            <TextField label="WhatsApp number" inputMode="tel" placeholder="Same as phone if blank" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} error={errs.whatsapp} />
            <TextField label="Email (optional)" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} error={errs.email} />
            <TextField label="Location" placeholder="Kaduna, Nigeria" value={f.location} onChange={(e) => set('location', e.target.value)} />
          </>)}
          {step === 2 && (<>
            {(['primary', 'secondary'] as const).map((k) => (
              <fieldset key={k}>
                <legend className="mb-2 text-sm font-semibold text-charcoal-400">{k === 'primary' ? 'Primary brand colour' : 'Secondary brand colour'}</legend>
                <div className="flex flex-wrap items-center gap-2">
                  {PALETTE.map((c) => (
                    <button key={c} type="button" onClick={() => set(k, c)} aria-label={`${k} colour ${c}`} aria-pressed={f[k] === c}
                      style={{ background: c }} className={cx('h-11 w-11 rounded-full border-2', f[k] === c ? 'border-charcoal ring-2 ring-gold' : 'border-white')} />
                  ))}
                  <input type="color" value={f[k]} onChange={(e) => set(k, e.target.value)} aria-label={`Custom ${k} colour`} className="h-11 w-14 cursor-pointer rounded-lg border border-charcoal-100 bg-white" />
                </div>
              </fieldset>
            ))}
            <TextArea label="Welcome message for customers" placeholder={`Thank you for choosing ${f.name || 'us'}. We are excited to make your occasion special.`} value={f.welcome} onChange={(e) => set('welcome', e.target.value)} hint="Shown at the top of every customer’s private page. You can change it any time." />
            <div className="rounded-2xl p-4 text-white" style={{ background: f.primary }}>
              <p className="text-xs uppercase tracking-widest opacity-80">Preview</p>
              <p className="font-display text-2xl">{f.name || 'Your business'}</p>
              <span className="mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ background: f.secondary }}>Your event journey</span>
            </div>
          </>)}
          {error && <ErrorBox message={error} />}
          <div className="flex gap-3 pt-2">
            {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)} className="flex-1">Back</Button>}
            {step < 2
              ? <Button className="flex-1" onClick={() => validateStep(step) && setStep(step + 1)}>Continue</Button>
              : <Button className="flex-1" loading={busy} loadingText="Setting up..." onClick={finish}>Finish setup</Button>}
          </div>
        </Card>
      </div>
    </main>
  );
}

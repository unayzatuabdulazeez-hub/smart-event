'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { optionalEmailError, optionalPhoneError } from '@/lib/validation';
import type { Customer } from '@/lib/types';
import { Button, ErrorBox, SelectField, TextArea, TextField } from './ui';

export default function CustomerForm({ businessId, customer, onSaved, onCancel }: {
  businessId: string; customer?: Customer; onSaved: (c: Customer) => void; onCancel?: () => void;
}) {
  const [f, setF] = useState({
    name: customer?.name ?? '', phone: customer?.phone ?? '', whatsapp: customer?.whatsapp ?? '', email: customer?.email ?? '',
    address: customer?.address ?? '', preferred_contact: customer?.preferred_contact ?? 'whatsapp', notes: customer?.notes ?? '',
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.name.trim()) er.name = 'Enter the customer’s name.';
    const p = optionalPhoneError(f.phone); if (p) er.phone = p;
    const w = optionalPhoneError(f.whatsapp); if (w) er.whatsapp = w;
    const m = optionalEmailError(f.email); if (m) er.email = m;
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true); setError(null);
    try {
      const sb = supabaseBrowser();
      const payload = {
        name: f.name.trim(), phone: f.phone.trim() || null, whatsapp: (f.whatsapp || f.phone).trim() || null, email: f.email.trim() || null,
        address: f.address.trim() || null, preferred_contact: f.preferred_contact, notes: f.notes.trim() || null,
      };
      const res = customer
        ? await sb.from('customers').update(payload).eq('id', customer.id).select().single()
        : await sb.from('customers').insert({ ...payload, business_id: businessId }).select().single();
      if (res.error) throw res.error;
      onSaved(res.data as Customer);
    } catch (err) { setError(friendlyError(err, 'Unable to save customer.')); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <TextField label="Full name" value={f.name} onChange={(e) => set('name', e.target.value)} error={errs.name} autoComplete="off" />
      <TextField label="Phone" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} error={errs.phone} placeholder="0803 123 4567" />
      <TextField label="WhatsApp" inputMode="tel" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} error={errs.whatsapp} hint="Leave blank if it is the same as the phone number." />
      <TextField label="Email (optional)" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} error={errs.email} />
      <TextField label="Address (optional)" value={f.address} onChange={(e) => set('address', e.target.value)} />
      <SelectField label="Preferred contact" value={f.preferred_contact} onChange={(e) => set('preferred_contact', e.target.value)}>
        <option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option><option value="email">Email</option>
      </SelectField>
      <TextArea label="Private notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} hint="Only you can see these. Customers never do." placeholder="e.g. Do not call after 9pm." />
      {error && <ErrorBox message={error} />}
      <div className="flex gap-3">
        {onCancel && <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" className="flex-1" loading={busy} loadingText="Saving...">{customer ? 'Save changes' : 'Add customer'}</Button>
      </div>
    </form>
  );
}

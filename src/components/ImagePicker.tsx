'use client';
import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { uploadImage } from '@/lib/upload';
import { Button } from './ui';

export default function ImagePicker({ label, bucket, businessId, value, onChange, shape = 'square' }: {
  label: string; bucket: 'branding' | 'event-images'; businessId: string; value: string | null;
  onChange: (url: string) => void; shape?: 'square' | 'wide';
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function pick(f?: File) {
    if (!f) return;
    setBusy(true); setErr(null);
    try { onChange(await uploadImage(bucket, businessId, f)); }
    catch (e) { setErr((e as Error).message || 'Image upload failed. Please try again.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-charcoal-400">{label}</p>
      <div className="flex items-center gap-3">
        <div className={`grid shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-gold/60 bg-cream-50 ${shape === 'square' ? 'h-20 w-20' : 'h-20 w-36'}`}>
          {value ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={value} alt={`${label} preview`} className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-charcoal-200" aria-hidden />}
        </div>
        <Button type="button" variant="secondary" size="sm" loading={busy} loadingText="Uploading..." onClick={() => input.current?.click()}>{value ? 'Change' : 'Upload'}</Button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} aria-label={`Choose ${label}`} />
      </div>
      {err && <p role="alert" className="text-xs font-semibold text-coral-600">{err}</p>}
    </div>
  );
}

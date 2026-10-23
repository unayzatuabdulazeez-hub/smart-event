import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MessageCircle, MapPin, Phone } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase/server';
import { whatsappLink } from '@/lib/whatsapp';
import { contrast, readableOn, safeColor } from '@/lib/color';
import { PoweredBy } from '@/components/ui';

export const dynamic = 'force-dynamic';

async function load(slug: string) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const { data } = await supabaseAdmin().rpc('get_public_business', { p_slug: slug });
  return data as null | { name: string; description: string | null; location: string | null; phone: string | null; whatsapp: string | null; logo_url: string | null; cover_url: string | null; primary_color: string; secondary_color: string; services: string[] };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const b = await load(params.slug);
  return b ? { title: b.name, description: b.description ?? undefined } : { title: 'Not found' };
}

export default async function BusinessPage({ params }: { params: { slug: string } }) {
  const b = await load(params.slug);
  if (!b) notFound();
  const brand = safeColor(b.primary_color, '#7A1F3D');
  const on = readableOn(brand);
  const brandText = contrast(brand, '#FFFFFF') >= 4.5 ? brand : '#2B2523';
  const wa = whatsappLink(b.whatsapp || b.phone, `Hello ${b.name}, I would like to make an enquiry.`);
  return (
    <main className="min-h-screen bg-cream-100">
      <header className="relative" style={{ background: brand, color: on }}>
        {b.cover_url && <img src={b.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
        <div className="relative mx-auto max-w-xl px-5 py-14 text-center">
          {b.logo_url && <img src={b.logo_url} alt={`${b.name} logo`} className="mx-auto mb-4 h-20 w-20 rounded-full bg-white object-cover" />}
          <h1 className="font-display text-4xl">{b.name}</h1>
          {b.location && <p className="mt-2 inline-flex items-center gap-1.5 text-sm opacity-90"><MapPin className="h-4 w-4" />{b.location}</p>}
        </div>
      </header>
      <div className="mx-auto max-w-xl space-y-5 px-5 py-8">
        {b.description && <p className="text-center text-lg">{b.description}</p>}
        {b.services?.length > 0 && <ul className="flex flex-wrap justify-center gap-2">{b.services.map((s) => <li key={s} className="rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-card">{s}</li>)}</ul>}
        <div className="grid gap-3">
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl px-6 font-bold" style={{ background: brand, color: on }}><MessageCircle className="h-5 w-5" /> Chat on WhatsApp</a>}
          {b.phone && <a href={`tel:${b.phone}`} className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 bg-white px-6 font-bold" style={{ borderColor: brand, color: brandText }}><Phone className="h-5 w-5" /> Call us</a>}
        </div>
        <PoweredBy className="pt-6" />
      </div>
    </main>
  );
}

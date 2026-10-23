'use client';
import Link from 'next/link';
import { BarChart3, Calculator, CheckSquare, FileText, Globe, HeartHandshake, LayoutTemplate, Palette, Receipt, Settings, Store, Truck } from 'lucide-react';
import { useBusiness } from '@/components/BusinessProvider';
import { PageHeader } from '@/components/ui';

const ITEMS = [
  { href: '/app/quotes', label: 'Quotes', icon: FileText, hint: 'Professional quotations' },
  { href: '/app/vendors', label: 'Vendors', icon: Truck, hint: 'Your suppliers and partners' },
  { href: '/app/expenses', label: 'Expenses', icon: Receipt, hint: 'Costs across events' },
  { href: '/app/costing', label: 'Costing Tools', icon: Calculator, hint: 'Catering and small chops' },
  { href: '/app/templates', label: 'Templates', icon: LayoutTemplate, hint: 'Saved packages' },
  { href: '/app/tasks', label: 'Tasks', icon: CheckSquare, hint: 'Things to do' },
  { href: '/app/follow-ups', label: 'Follow-ups', icon: HeartHandshake, hint: 'After-event reminders' },
  { href: '/app/portals', label: 'Portal Links', icon: Globe, hint: 'Customer pages' },
  { href: '/app/insights', label: 'Insights', icon: BarChart3, hint: 'How your business is doing' },
  { href: '/app/branding', label: 'Branding & Profile', icon: Palette, hint: 'Logo, colours, contact' },
  { href: '/app/settings', label: 'Settings', icon: Settings, hint: 'Account and services' },
];

export default function More() {
  const { business } = useBusiness();
  return (
    <div className="space-y-5">
      <PageHeader title="More" />
      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className="flex min-h-[72px] items-center gap-4 rounded-2xl bg-white p-4 shadow-card hover:border-burgundy/30">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-burgundy-50 text-burgundy"><i.icon className="h-6 w-6" /></span>
            <span><span className="block font-semibold">{i.label}</span><span className="text-sm text-charcoal-300">{i.hint}</span></span>
          </Link>
        ))}
        <Link href={`/business/${business.slug}`} target="_blank" className="flex min-h-[72px] items-center gap-4 rounded-2xl bg-white p-4 shadow-card">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald"><Store className="h-6 w-6" /></span>
          <span><span className="block font-semibold">Your public page</span><span className="text-sm text-charcoal-300">/business/{business.slug}</span></span>
        </Link>
      </div>
    </div>
  );
}

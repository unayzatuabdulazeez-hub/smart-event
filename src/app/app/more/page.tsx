'use client';
import Link from 'next/link';
import { BarChart3, Calculator, CheckSquare, Copy, ExternalLink, FileText, Globe, HeartHandshake, Inbox, LayoutTemplate, MessageCircle, Palette, Receipt, Settings, Truck } from 'lucide-react';
import { useBusiness } from '@/components/BusinessProvider';
import { Button, Card, PageHeader, useToast } from '@/components/ui';

const ITEMS = [
  { href: '/app/requests', label: 'Requests', icon: Inbox, hint: 'Customers asking to book' },
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
  const { toast, node } = useToast();
  const origin = (process.env.NEXT_PUBLIC_APP_URL || (typeof location !== 'undefined' ? location.origin : '')).replace(/\/$/, '');
  const link = `${origin}/business/${business.slug}`;
  const shareText = `Book ${business.name} here: ${link}`;

  async function copy() {
    try { await navigator.clipboard.writeText(link); toast.ok('Link copied'); }
    catch { toast.err('Could not copy. Press and hold the link to copy it.'); }
  }
  return (
    <div className="space-y-5">{node}
      <PageHeader title="More" />
      <Card className="space-y-3">
        <h2 className="font-display text-xl">Your booking link</h2>
        <p className="text-sm text-charcoal-300">Send this link to customers. They can see your business and request a booking.</p>
        <p className="select-all break-all rounded-xl bg-cream-100 p-3 text-sm font-semibold">{link}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={copy}><Copy className="h-4 w-4" /> Copy link</Button>
          <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-emerald px-3.5 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" /> Share on WhatsApp</a>
          <Link href={`/business/${business.slug}`} target="_blank" className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-charcoal-100 bg-white px-3.5 text-sm font-semibold"><ExternalLink className="h-4 w-4" /> Open page</Link>
        </div>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className="flex min-h-[72px] items-center gap-4 rounded-2xl bg-white p-4 shadow-card hover:border-burgundy/30">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-burgundy-50 text-burgundy"><i.icon className="h-6 w-6" /></span>
            <span><span className="block font-semibold">{i.label}</span><span className="text-sm text-charcoal-300">{i.hint}</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}

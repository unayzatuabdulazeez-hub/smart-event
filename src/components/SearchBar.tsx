'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export default function SearchBar({ initial = '' }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/app/search?q=${encodeURIComponent(q.trim())}`); }}
      className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-charcoal-200" aria-hidden />
      <input value={q} onChange={(e) => setQ(e.target.value)} type="search" aria-label="Search customers, events, venues or phone numbers"
        placeholder="Search name, phone, event, venue, booking no."
        className="min-h-[52px] w-full rounded-2xl border border-charcoal-100 bg-white pl-12 pr-4 text-[16px] shadow-card focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/20" />
    </form>
  );
}

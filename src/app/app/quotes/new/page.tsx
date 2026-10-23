'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import QuoteForm from '@/components/QuoteForm';
import { PageHeader } from '@/components/ui';

function Inner() {
  const ev = useSearchParams().get('event');
  return <div><PageHeader title="New quotation" /><QuoteForm presetEventId={ev} /></div>;
}
export default function NewQuote() { return <Suspense><Inner /></Suspense>; }

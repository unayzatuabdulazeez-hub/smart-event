'use client';
import { useParams } from 'next/navigation';
import QuoteForm from '@/components/QuoteForm';
import { PageHeader } from '@/components/ui';

export default function EditQuote() {
  const { id } = useParams<{ id: string }>();
  return <div><PageHeader title="Edit quotation" /><QuoteForm quoteId={id} /></div>;
}

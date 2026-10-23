'use client';
import { useRouter } from 'next/navigation';
import { useBusiness } from '@/components/BusinessProvider';
import CustomerForm from '@/components/CustomerForm';
import { Card, PageHeader } from '@/components/ui';

export default function NewCustomer() {
  const { business } = useBusiness();
  const router = useRouter();
  return (
    <div>
      <PageHeader title="Add customer" />
      <Card><CustomerForm businessId={business.id} onSaved={(c) => router.replace(`/app/customers/${c.id}`)} onCancel={() => router.back()} /></Card>
    </div>
  );
}

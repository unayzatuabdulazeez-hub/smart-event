import CostingTools from '@/components/CostingTools';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Costing tools' };
export default function CostingPage() {
  return <div><PageHeader title="Costing tools" subtitle="Know your numbers before you quote" /><CostingTools /></div>;
}

import BusinessProvider from '@/components/BusinessProvider';
import OnboardingGate from '@/components/OnboardingGate';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <BusinessProvider>
      <OnboardingGate>{children}</OnboardingGate>
    </BusinessProvider>
  );
}

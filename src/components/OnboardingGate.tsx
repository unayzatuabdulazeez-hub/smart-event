'use client';
import { usePathname } from 'next/navigation';
import Shell from './Shell';

/** Onboarding renders without the app chrome; everything else gets the shell. */
export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === '/app/onboarding') return <>{children}</>;
  return <Shell>{children}</Shell>;
}

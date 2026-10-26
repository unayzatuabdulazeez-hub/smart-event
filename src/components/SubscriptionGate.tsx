'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { whatsappLink } from '@/lib/whatsapp';
import { formatNaira } from '@/lib/money';
import { Button, Card, PoweredBy } from './ui';

export interface Subscription { status: 'inactive' | 'active' | 'suspended'; paid_until: string | null }

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Shown instead of the app while the business has no active subscription.
 * The database also refuses writes in this state, so this screen is a courtesy, not the lock.
 */
export default function SubscriptionGate({ businessName, email, subscription, onCheckAgain }: {
  businessName: string; email: string; subscription: Subscription | null; onCheckAgain: () => Promise<void>;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stillLocked, setStillLocked] = useState(false);

  useEffect(() => {
    supabaseBrowser().from('platform_settings').select('key, value').then(({ data }) => {
      const m: Record<string, string> = {};
      (data ?? []).forEach((r: { key: string; value: string }) => { m[r.key] = r.value; });
      setSettings(m);
    });
  }, []);

  const price = Number(settings?.monthly_price) || 2999;
  const expired = subscription?.status === 'active' && !!subscription.paid_until;
  const suspended = subscription?.status === 'suspended';
  const hasBank = !!(settings?.bank_name && settings?.account_number && settings?.account_name);
  const message = `Hello, I have paid ${formatNaira(price)} for Unaabs Smart Events. Business: ${businessName}. Account email: ${email}.`;
  const wa = whatsappLink(settings?.support_whatsapp, message);

  async function copyNumber() {
    try { await navigator.clipboard.writeText(settings?.account_number ?? ''); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  }
  async function checkAgain() {
    setChecking(true); setStillLocked(false);
    await onCheckAgain();
    setChecking(false); setStillLocked(true);
  }
  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.replace('/login'); router.refresh();
  }

  return (
    <main className="min-h-screen bg-cream-100">
      <div className="kente" />
      <div className="mx-auto max-w-md space-y-5 px-5 py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-600">Unaabs Smart Events</p>
        <h1 className="font-display text-3xl">
          {suspended ? 'Your account is paused' : expired ? 'Time to renew' : 'Activate your account'}
        </h1>
        <p className="text-charcoal-300">
          {suspended
            ? 'Your account is currently suspended. Please contact support to get it switched back on.'
            : expired
              ? `Your subscription ended on ${fmtDate(subscription!.paid_until!)}. Your information is safe. Renew to carry on where you stopped.`
              : `${businessName} is set up. Pay ${formatNaira(price)} for 30 days to start using the app.`}
        </p>

        {!suspended && (
          <Card className="space-y-4">
            <h2 className="font-display text-xl">Pay by bank transfer</h2>
            {settings === null ? (
              <p className="text-sm text-charcoal-300">Loading payment details...</p>
            ) : hasBank ? (
              <dl className="space-y-3 text-sm">
                <div><dt className="text-charcoal-300">Amount</dt><dd className="text-lg font-semibold">{formatNaira(price)} / 30 days</dd></div>
                <div><dt className="text-charcoal-300">Bank</dt><dd className="font-semibold">{settings.bank_name}</dd></div>
                <div><dt className="text-charcoal-300">Account name</dt><dd className="font-semibold">{settings.account_name}</dd></div>
                <div>
                  <dt className="text-charcoal-300">Account number</dt>
                  <dd className="flex items-center justify-between gap-3">
                    <span className="text-lg font-semibold tracking-wider">{settings.account_number}</span>
                    <Button variant="secondary" size="sm" onClick={copyNumber}>{copied ? 'Copied' : 'Copy'}</Button>
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="rounded-xl bg-gold-50 p-3 text-sm text-charcoal-400">Payment details have not been added yet. Please contact support and we will send them to you.</p>
            )}
            <ol className="list-decimal space-y-1 pl-5 text-sm text-charcoal-300">
              <li>Transfer the amount above.</li>
              <li>Use <span className="font-semibold text-charcoal-500">{businessName}</span> as the payment description.</li>
              <li>Send us your receipt so we can confirm it.</li>
              <li>We switch your account on after we confirm the payment. Then tap “I have been activated”.</li>
            </ol>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700">Send receipt on WhatsApp</a>}
          </Card>
        )}

        {suspended && wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700">Contact support on WhatsApp</a>}

        <Button className="w-full" onClick={checkAgain} loading={checking} loadingText="Checking...">I have been activated</Button>
        {stillLocked && <p role="status" className="text-center text-sm text-charcoal-300">Not active yet. We activate accounts only after confirming your payment.</p>}
        <button onClick={logout} className="block w-full py-2 text-center text-sm font-semibold text-burgundy">Log out</button>
        <PoweredBy className="mt-8" />
      </div>
    </main>
  );
        }

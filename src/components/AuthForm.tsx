'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/errors';
import { isEmail } from '@/lib/validation';
import { Button, TextField, ErrorBox, PoweredBy } from './ui';

export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setNotice(null);
    const errs: Record<string, string> = {};
    if (mode === 'signup' && name.trim().length < 2) errs.name = 'Please enter your name.';
    if (!isEmail(email)) errs.email = 'Enter a valid email address.';
    if (password.length < 8) errs.password = 'Use at least 8 characters.';
    setFe(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const sb = supabaseBrowser();
      if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(), password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: `${location.origin}/app` },
        });
        if (error) throw error;
        if (!data.session) { setNotice('Check your email to confirm your account, then log in.'); return; }
        router.replace('/app/onboarding');
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        const next = params.get('next');
        router.replace(next && next.startsWith('/app') ? next : '/app');
      }
      router.refresh();
    } catch (err) {
      setError(friendlyError(err, mode === 'signup' ? 'Unable to create your account. Please try again.' : 'Unable to log in. Please try again.'));
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-cream-100">
      <div className="kente" />
      <div className="mx-auto max-w-md px-5 py-12">
        <Link href="/" className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-600">Unaabs Smart Events</Link>
        <h1 className="mt-3 font-display text-4xl">{mode === 'signup' ? 'Create your business account' : 'Welcome back ❤️'}</h1>
        <p className="mt-2 text-charcoal-300">{mode === 'signup' ? 'It takes about two minutes.' : 'Log in to see what needs your attention today.'}</p>
        <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
          {mode === 'signup' && <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" error={fe.name} />}
          <TextField label="Email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" error={fe.email} />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} error={fe.password} />
          {error && <ErrorBox message={error} />}
          {notice && <p role="status" className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</p>}
          <Button type="submit" className="w-full" loading={busy} loadingText={mode === 'signup' ? 'Creating account...' : 'Logging in...'}>
            {mode === 'signup' ? 'Create account' : 'Log in'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-charcoal-300">
          {mode === 'signup' ? <>Already have an account? <Link className="font-semibold text-burgundy" href="/login">Log in</Link></> : <>New here? <Link className="font-semibold text-burgundy" href="/signup">Create an account</Link></>}
        </p>
        <PoweredBy className="mt-12" />
      </div>
    </main>
  );
}

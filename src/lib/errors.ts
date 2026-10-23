/** Turn any thrown/returned error into a calm, non-technical message. Never leak SQL or stack traces. */
export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = err as { message?: string; code?: string; status?: number } | null;
  const m = (e?.message ?? '').toLowerCase();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Your internet connection may be unstable.';
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed')) return 'Your internet connection may be unstable.';
  if (m.includes('overpayment')) return 'This payment is more than the remaining balance.';
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Incorrect email or password.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with this email already exists. Try logging in.';
  if (m.includes('password') && m.includes('characters')) return 'Your password must be at least 8 characters.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first, then log in.';
  if (m.includes('jwt') || m.includes('not_authenticated') || e?.status === 401) return 'Your session has ended. Please log in again.';
  if (e?.code === '42501' || m.includes('row-level security')) return 'You do not have permission to do that.';
  if (e?.code === '23505') return 'That already exists.';
  if (e?.code === '23503') return 'This item is linked to other records and cannot be removed.';
  return fallback;
}

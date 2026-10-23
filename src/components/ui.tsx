'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { cx } from '@/lib/cx';
export { cx };

/* ---------- Buttons ---------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'whatsapp' | 'gold';
  size?: 'md' | 'sm'; loading?: boolean; loadingText?: string;
};
export function Button({ variant = 'primary', size = 'md', loading, loadingText, className, children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-burgundy text-white hover:bg-burgundy-600',
    secondary: 'bg-white text-charcoal border border-charcoal-100 hover:bg-cream-200',
    ghost: 'text-burgundy hover:bg-burgundy-50',
    danger: 'bg-coral-600 text-white hover:bg-coral-500',
    whatsapp: 'bg-emerald text-white hover:bg-emerald-600',
    gold: 'bg-gold text-charcoal hover:bg-gold-600 hover:text-white',
  }[variant];
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed',
        size === 'md' ? 'min-h-[48px] px-5 text-[15px]' : 'min-h-[40px] px-3.5 text-sm', v, className)}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

/* ---------- Cards ---------- */
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx('rounded-2xl bg-white shadow-card border border-cream-300/60 p-4 sm:p-5', className)}>{children}</div>;
}
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-xl text-charcoal">{children}</h2>
      {action}
    </div>
  );
}
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl text-charcoal">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-charcoal-300">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Badges (text + colour, never colour alone) ---------- */
const TONES: Record<string, string> = {
  neutral: 'bg-charcoal-100/50 text-charcoal-400', good: 'bg-emerald-50 text-emerald-700', warn: 'bg-gold-50 text-gold-600',
  bad: 'bg-coral-50 text-coral-600', brand: 'bg-burgundy-50 text-burgundy-600',
};
export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof TONES | string; children: React.ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', TONES[tone] ?? TONES.neutral)}>{children}</span>;
}
export function statusTone(s: string) {
  if (['completed', 'paid_in_full', 'confirmed', 'deposit_paid', 'accepted', 'done'].includes(s)) return 'good';
  if (['cancelled', 'declined', 'expired'].includes(s)) return 'bad';
  if (['awaiting_approval', 'quote_sent', 'partially_paid', 'awaiting_payment', 'inquiry'].includes(s)) return 'warn';
  return 'brand';
}

/* ---------- Form fields ---------- */
export const inputCls = 'w-full min-h-[48px] rounded-xl border border-charcoal-100 bg-white px-3.5 text-[16px] placeholder:text-charcoal-200 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/20';

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-charcoal-400">{label}</label>
      {children(id)}
      {hint && !error && <p className="text-xs text-charcoal-300">{hint}</p>}
      {error && <p role="alert" className="text-xs font-semibold text-coral-600">{error}</p>}
    </div>
  );
}
export function TextField({ label, hint, error, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null }) {
  return <Field label={label} hint={hint} error={error}>{(id) => <input id={id} {...rest} className={cx(inputCls, rest.className)} aria-invalid={!!error} />}</Field>;
}
export function TextArea({ label, hint, error, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string | null }) {
  return <Field label={label} hint={hint} error={error}>{(id) => <textarea id={id} rows={3} {...rest} className={cx(inputCls, 'py-3', rest.className)} />}</Field>;
}
export function SelectField({ label, hint, error, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string | null }) {
  return <Field label={label} hint={hint} error={error}>{(id) => <select id={id} {...rest} className={cx(inputCls, rest.className)}>{children}</select>}</Field>;
}
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 text-sm font-medium">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-6 w-11 cursor-pointer accent-emerald" />
    </label>
  );
}

/* ---------- Modal (sheet on mobile) ---------- */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/50 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-cream-50 p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full hover:bg-cream-200"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- States ---------- */
export function Skeleton({ className }: { className?: string }) { return <div className={cx('skeleton', className)} aria-hidden />; }
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return <div className="space-y-3" role="status" aria-label="Loading">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;
}
export function EmptyState({ emoji = '❤️', title, body, action }: { emoji?: string; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-gold/60 bg-cream-50 px-6 py-10 text-center">
      <div className="text-4xl" aria-hidden>{emoji}</div>
      <p className="mt-3 font-display text-xl">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-sm text-charcoal-300">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-coral/40 bg-coral-50 p-4 text-sm text-coral-600">
      <p className="font-semibold">{message}</p>
      {onRetry && <button onClick={onRetry} className="mt-2 font-semibold underline">Try again</button>}
    </div>
  );
}

/* ---------- Toast ---------- */
export function useToast() {
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); }, [msg]);
  const node = msg ? (
    <div role="status" className={cx('fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg', msg.tone === 'ok' ? 'bg-emerald' : 'bg-coral-600')}>{msg.text}</div>
  ) : null;
  return { toast: { ok: (t: string) => setMsg({ text: t, tone: 'ok' }), err: (t: string) => setMsg({ text: t, tone: 'err' }) }, node };
}

/* ---------- Money row ---------- */
export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' | 'brand' }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-300">{label}</p>
      <p className={cx('font-display text-2xl', tone === 'good' && 'text-emerald', tone === 'bad' && 'text-coral-600', tone === 'brand' && 'text-burgundy')}>{value}</p>
    </div>
  );
}

export const PoweredBy = ({ className }: { className?: string }) => (
  <p className={cx('text-center text-xs text-charcoal-200', className)}>Powered by Unaabs Smart Business</p>
);

import { Check } from 'lucide-react';
import type { JourneyStep } from '@/lib/status';
import { cx } from '@/lib/cx';

/** The Event Journey. State is conveyed by icon + text, never colour alone. */
export default function Journey({ steps, accent = '#0F7B5F', tone = 'light', checkColor = '#FFFFFF' }: { steps: JourneyStep[]; accent?: string; tone?: 'light' | 'dark'; checkColor?: string }) {
  return (
    <ol className="space-y-0" aria-label="Event journey">
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex items-start gap-3 pb-5 last:pb-0" aria-current={s.state === 'current' ? 'step' : undefined}>
          {i < steps.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-0.5 bg-charcoal-100" aria-hidden />}
          <span className={cx('relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold',
            s.state === 'current' && 'bg-white', s.state === 'todo' && 'border-charcoal-100 bg-white')}
            style={s.state === 'done' ? { background: accent, borderColor: accent, color: checkColor } : s.state === 'current' ? { borderColor: accent } : undefined}>
            {s.state === 'done' ? <Check className="h-4 w-4" aria-hidden /> : s.state === 'current' ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} aria-hidden /> : null}
          </span>
          <span className={cx('pt-0.5 text-[15px]', s.state === 'todo' ? 'text-charcoal-200' : tone === 'dark' ? 'text-white' : 'text-charcoal', s.state === 'current' && 'font-bold')}>
            {s.label}
            <span className="sr-only"> ({s.state === 'done' ? 'completed' : s.state === 'current' ? 'in progress' : 'not started'})</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

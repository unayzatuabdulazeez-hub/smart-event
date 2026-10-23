import { Check } from 'lucide-react';
import type { JourneyStep } from '@/lib/status';
import { cx } from '@/lib/cx';

/** Shared by the owner view and the customer portal. State is conveyed by icon + text, not colour alone. */
export default function Journey({ steps, accent = '#0F7B5F' }: { steps: JourneyStep[]; accent?: string }) {
  return (
    <ol className="space-y-3" aria-label="Event journey">
      {steps.map((s) => (
        <li key={s.key} className="flex items-center gap-3" aria-current={s.state === 'current' ? 'step' : undefined}>
          <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold', s.state === 'todo' && 'border-charcoal-100 text-charcoal-200')}
            style={s.state === 'done' ? { background: accent, borderColor: accent, color: '#fff' } : s.state === 'current' ? { borderColor: accent, color: accent } : undefined}>
            {s.state === 'done' ? <Check className="h-4 w-4" aria-hidden /> : s.state === 'current' ? '●' : '○'}
          </span>
          <span className={cx('text-[15px]', s.state === 'todo' ? 'text-charcoal-200' : 'font-semibold')}>
            {s.label}
            <span className="sr-only">{s.state === 'done' ? ' (done)' : s.state === 'current' ? ' (in progress)' : ' (upcoming)'}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

import { formatBn } from '../../lib/districtData';

// A passport ledger: one tick per district, filled in discovery order. The numbers carry the
// meaning; the ticks are decoration and hidden from assistive tech.
export default function DiscoveryProgress({ count, total, fresh = false }) {
  return (
    <div className="shrink-0 text-right">
      <p className="leading-none whitespace-nowrap">
        <span className="text-[1.5rem] font-semibold tabular-nums sm:text-[1.9rem]">{count}</span>
        <span className="text-ink-3 tabular-nums"> / {total}</span>
        <span className="sr-only"> districts discovered</span>
      </p>
      <p className="mt-1 hidden text-[0.75rem] text-ink-3 sm:block" aria-hidden="true">
        districts discovered{' '}
        <span lang="bn">
          {formatBn(count)}/{formatBn(total)}
        </span>
      </p>
      <div className="mt-1.5 hidden gap-[2px] md:flex" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            data-new={fresh && i === count - 1}
            className={`ledger-tick h-2 w-[3px] rounded-[1px] ${i < count ? 'bg-found' : 'bg-rule-strong'}`}
          />
        ))}
      </div>
    </div>
  );
}

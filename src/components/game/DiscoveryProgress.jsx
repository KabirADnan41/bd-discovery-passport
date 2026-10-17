import { formatBn } from '../../lib/districtData';

// The masthead count. The numbers carry the meaning; the Bengali repeats them for Bengali readers (under the count on tablets,
// beside it on wide screens).
export default function DiscoveryProgress({ count, total }) {
  return (
    <div className="shrink-0 text-right xl:flex xl:items-baseline xl:gap-2.5">
      <p className="leading-none whitespace-nowrap">
        <span className="text-[1.25rem] font-[650] tabular-nums">{count}</span>
        <span className="text-ink-3 tabular-nums"> / {total}</span>
        <span className="sr-only"> districts discovered</span>
        <span className="ml-1.5 hidden text-[0.85rem] text-ink-3 sm:inline" aria-hidden="true">
          districts
        </span>
      </p>
      <p lang="bn" className="mt-0.5 hidden text-[0.75rem] leading-tight text-ink-3 sm:block xl:mt-0 xl:text-[0.8rem]" aria-hidden="true">
        {formatBn(count)}/{formatBn(total)} জেলা
      </p>
    </div>
  );
}

// The passport's ledger: the count, then a ruler of one tick per district, filled in discovery order. Decoration, hidden from
// assistive tech: the masthead already gives the count.
export function DiscoveryLedger({ count, total, className = '' }) {
  return (
    <div className={className} aria-hidden="true">
      <p className="flex flex-wrap items-baseline gap-x-2 leading-none">
        <span className="text-[2.6rem] font-[650] tracking-[-0.02em] tabular-nums">{count}</span>
        <span className="text-[1.1rem] text-ink-3 tabular-nums">/ {total}</span>
        <span className="ml-1 text-[0.9rem] text-ink-3">
          districts{' '}
          <span lang="bn">
            {formatBn(count)}/{formatBn(total)} জেলা
          </span>
        </span>
      </p>
      <div className="ledger-ruler mt-3" style={{ '--ticks': total }}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} data-filled={i < count || undefined} />
        ))}
      </div>
    </div>
  );
}

import { formatBn } from '../../lib/districtData';

// The masthead count. The numbers carry the meaning; the Bengali line repeats them for Bengali readers.
export default function DiscoveryProgress({ count, total }) {
  return (
    <div className="shrink-0 text-right">
      <p className="leading-none whitespace-nowrap">
        <span className="text-[1.4rem] font-[650] tabular-nums lg:text-h2">{count}</span>
        <span className="text-ink-3 tabular-nums"> / {total}</span>
        <span className="sr-only"> districts discovered</span>
        <span className="ml-1.5 hidden text-[0.85rem] text-ink-3 sm:inline" aria-hidden="true">
          districts
        </span>
      </p>
      <p lang="bn" className="mt-0.5 hidden text-[0.75rem] leading-tight text-ink-3 sm:block" aria-hidden="true">
        {formatBn(count)}/{formatBn(total)} জেলা
      </p>
    </div>
  );
}

// A passport ledger: one cell per district, filled in discovery order. It is decoration, hidden from assistive tech.
export function DiscoveryLedger({ count, total, className = '' }) {
  return (
    <div className={`hidden max-w-[440px] md:block ${className}`} aria-hidden="true">
      <p className="text-eyebrow text-brass uppercase">Your passport</p>
      <div className="mt-3 grid grid-cols-[repeat(32,minmax(0,1fr))] gap-[3px]">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`aspect-square rounded-[1px] ${i < count ? 'bg-found' : 'bg-rule'}`} />
        ))}
      </div>
    </div>
  );
}

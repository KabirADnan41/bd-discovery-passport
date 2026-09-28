import { DIVISIONS, formatBn } from '../../lib/districtData';

// The atlas gazetteer: every district by division. It doubles as the keyboard and
// touch-friendly way to reach districts that are tiny on the map.
export default function DistrictIndex({ discoveredSet, selectedId, onActivate }) {
  return (
    <section id="district-index" aria-labelledby="index-title" className="border-t border-rule px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
      <div className="mx-auto max-w-[1400px]">
        <h2 id="index-title" className="text-[1.75rem] leading-tight font-semibold text-balance sm:text-[2.1rem]">
          All 64 districts{' '}
          <span lang="bn" className="font-medium text-ink-3">
            ৬৪টি জেলা
          </span>
        </h2>
        <p className="mt-2 max-w-[60ch] text-ink-2">Every district, grouped by division. Choosing one here works just like choosing it on the map.</p>

        <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {DIVISIONS.map(division => {
            const found = division.districts.filter(d => discoveredSet.has(d.id)).length;
            return (
              <div key={division.id}>
                <h3 className="flex items-baseline justify-between gap-3 border-b border-rule-strong pb-2">
                  <span className="font-semibold">
                    {division.name}{' '}
                    <span lang="bn" className="font-normal text-ink-3">
                      {division.bn}
                    </span>
                  </span>
                  <span className="text-[0.8rem] text-ink-3 tabular-nums">
                    {found}/{division.districts.length}
                    <span className="sr-only"> discovered</span>
                  </span>
                </h3>
                <ul className="mt-1">
                  {division.districts.map(d => {
                    const discovered = discoveredSet.has(d.id);
                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={e => onActivate(d.id, e.detail === 0 ? 'keyboard' : 'pointer')}
                          aria-current={d.id === selectedId ? 'true' : undefined}
                          className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-[8px] px-2 text-left transition-colors duration-150 hover:bg-sunk aria-[current=true]:bg-sunk"
                        >
                          <span>
                            <span className={discovered ? 'font-medium' : ''}>{d.name}</span>{' '}
                            <span lang="bn" className="text-[0.92rem] text-ink-3">
                              {d.bn}
                            </span>
                          </span>
                          {discovered ? (
                            <span className="flex items-center gap-1.5 text-[0.72rem] font-semibold tracking-[0.1em] text-stamp uppercase">
                              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                                <circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                                <circle cx="7" cy="7" r="2.2" fill="currentColor" />
                              </svg>
                              Stamped
                            </span>
                          ) : (
                            <span className="sr-only">not yet discovered</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-10 text-[0.85rem] text-ink-3">
          <span lang="bn">{formatBn(8)}টি বিভাগ, {formatBn(64)}টি জেলা।</span> 8 divisions, 64 districts.
        </p>
      </div>
    </section>
  );
}

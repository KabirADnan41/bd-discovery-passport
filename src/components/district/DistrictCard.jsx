import { useRef } from 'react';
import { formatBn, formatCoord, formatEn } from '../../lib/districtData';
import { dampedOffset, shouldDismiss } from '../../lib/sheetGesture';
import PassportStamp from './PassportStamp';

const TYPE_LABEL = { food: 'Food', culture: 'Culture', craft: 'Craft', tradition: 'Tradition' };

function ClaimList({ items, kindLabel }) {
  return (
    <ul className="grid">
      {items.map(item => (
        <li key={item.name.en} className="border-t border-rule py-3.5 first:border-t-0 first:pt-1">
          <p className="flex flex-wrap items-baseline gap-x-2 leading-snug">
            <span className="text-[1.08rem] font-semibold">{item.name.en}</span>
            <span lang="bn" className="text-ink-2">
              {item.name.bn}
            </span>
            {/* the kind of place, set like an atlas index entry rather than as a label above the name */}
            <span className="ml-auto text-[0.8rem] text-ink-3">{kindLabel(item)}</span>
          </p>
          <p className="mt-1 max-w-[60ch] text-[1rem] leading-relaxed text-ink-2">{item.note}</p>
          <p className="mt-1.5 text-[0.78rem] text-ink-3">
            Source:{' '}
            {item.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ', '}
                <a className="link" href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </span>
            ))}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, bn, children }) {
  return (
    <section className="mt-7">
      <h3 className="mb-2 flex items-baseline gap-2 border-b border-rule-strong pb-2 text-[0.95rem] font-semibold">
        {title}
        <span lang="bn" className="font-normal text-ink-3">
          {bn}
        </span>
      </h3>
      {children}
    </section>
  );
}

/**
 * Drag-to-dismiss for the mobile sheet. The transform is written straight to the element while
 * dragging (no React state, no CSS variables), then handed back to the CSS transitions on release.
 */
function useSheetDrag(sheetRef, onDismiss) {
  const drag = useRef(null);
  const end = e => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    const sheet = sheetRef.current;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (shouldDismiss({ dy: d.dy, elapsedMs: performance.now() - d.t0, sheetHeight: sheet.offsetHeight })) onDismiss();
  };
  return {
    handleProps: {
      onPointerDown: e => {
        if (drag.current) return; // ignore a second finger mid-drag
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { id: e.pointerId, y0: e.clientY, t0: performance.now(), dy: 0 };
        sheetRef.current.style.transition = 'none';
      },
      onPointerMove: e => {
        const d = drag.current;
        if (!d || e.pointerId !== d.id) return;
        d.dy = e.clientY - d.y0;
        sheetRef.current.style.transform = `translateY(${dampedOffset(d.dy)}px)`;
      },
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}

export default function DistrictCard({ details, isNew, exiting = false, headingRef, sheetRef, onClose, onSelect }) {
  const { handleProps } = useSheetDrag(sheetRef, onClose);
  const { id, name, bn, division, stampCode, content, areaKm2, lat, lon, neighbors } = details;
  const landmarks = content?.landmarks ?? [];
  const cultureFood = content?.cultureFood ?? [];

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="passport-title"
      ref={sheetRef}
      className="sheet card-shell"
      data-exiting={exiting}
      inert={exiting}
    >
      <div className="sheet-handle lg:hidden" aria-hidden="true" {...handleProps}>
        <span />
      </div>
      <div className="passport-cover-lg">
        <article key={id} className="passport-page passport-enter overflow-y-auto overscroll-contain px-5 pt-4 pb-6 sm:px-7">
          <div className="flex justify-end">
            <button type="button" className="btn btn-quiet -mr-2 min-h-11 px-4 text-[0.85rem]" onClick={onClose}>
              Close
            </button>
          </div>

          <header className="mt-2 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                id="passport-title"
                ref={headingRef}
                tabIndex={-1}
                className={`${name.length > 10 ? 'text-[1.9rem] sm:text-[2.2rem]' : 'text-[2.35rem] sm:text-[2.7rem]'} leading-[1.05] font-semibold tracking-[-0.01em] text-balance [overflow-wrap:anywhere]`}
              >
                {name}
              </h2>
              <p lang="bn" className="mt-1 text-[1.7rem] leading-tight font-medium text-ink-2">
                {bn}
              </p>
              <p className="mt-3 text-[0.95rem] text-ink-2">
                {division.name} Division{' '}
                <span lang="bn" className="text-ink-3">
                  {division.bn} বিভাগ
                </span>
              </p>
            </div>
            <div className="-mt-1 -mr-1 flex flex-col items-center">
              <PassportStamp id={id} code={stampCode} name={name} bn={bn} division={division.name} impact={isNew} size={116} />
              {isNew && (
                <p className="mt-1 text-[0.72rem] font-semibold tracking-[0.12em] text-stamp uppercase">
                  New stamp <span lang="bn" className="normal-case tracking-normal">নতুন সিল</span>
                </p>
              )}
            </div>
          </header>

          {landmarks.length > 0 && (
            <Section title="Landmarks" bn="দর্শনীয় স্থান">
              <ClaimList items={landmarks} kindLabel={item => item.category} />
            </Section>
          )}
          {cultureFood.length > 0 && (
            <Section title="Food, craft and tradition" bn="খাবার, কারুশিল্প ও ঐতিহ্য">
              <ClaimList items={cultureFood} kindLabel={item => TYPE_LABEL[item.type]} />
            </Section>
          )}
          {!content && (
            <div className="mt-7 rounded-[10px] bg-sunk px-4 py-4">
              <p className="font-medium">More discoveries coming soon.</p>
              <p lang="bn" className="text-ink-2">
                আরও তথ্য শিগগিরই আসছে।
              </p>
              <p className="mt-1.5 text-[0.85rem] text-ink-3">We only publish landmarks and traditions once they are checked against a source.</p>
            </div>
          )}

          <Section title="At a glance" bn="এক নজরে">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[0.92rem]">
              <div>
                <dt className="text-[0.78rem] text-ink-3">Area</dt>
                <dd className="tabular-nums">
                  about {formatEn(areaKm2)} km²{' '}
                  <span lang="bn" className="text-ink-3">
                    ({formatBn(areaKm2)} বর্গকিমি)
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-[0.78rem] text-ink-3">District town</dt>
                <dd className="tabular-nums">{formatCoord(lat, lon)}</dd>
              </div>
            </dl>
          </Section>

          <Section title="Neighbouring districts" bn="প্রতিবেশী জেলা">
            <ul className="flex flex-wrap gap-2">
              {neighbors.map(n => (
                <li key={n.id}>
                  <button type="button" className="btn btn-quiet min-h-10 px-3.5 text-[0.88rem] font-medium" onClick={() => onSelect(n.id)}>
                    {n.name}
                    <span lang="bn" className="font-normal text-ink-3">
                      {n.bn}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          <p className="mt-6 text-[0.75rem] leading-relaxed text-ink-3">
            {content ? 'Every claim on this page links to the source it was checked against.' : 'Area and borders are computed from the boundary data.'}
          </p>
        </article>
      </div>
    </section>
  );
}

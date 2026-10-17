import { useEffect, useRef, useState } from 'react';
import { formatBn, formatCoord, formatEn } from '../../lib/districtData';
import { directionsUrl, loadPlaces } from '../../lib/places';
import { dampedOffset, shouldDismiss } from '../../lib/sheetGesture';
import PassportStamp from './PassportStamp';

const TYPE_LABEL = { food: 'Food', culture: 'Culture', craft: 'Craft', tradition: 'Tradition' };

/** Adds a place to the trip. In the trip it stays a focusable button (aria-disabled, not disabled) and a press does nothing. */
function AddToTripButton({ place, inTrip, onAdd }) {
  const label = inTrip ? 'In your trip' : 'Add to trip';
  return (
    <button type="button" className="btn btn-quiet min-h-11 px-4 text-[0.88rem]" aria-disabled={inTrip || undefined} onClick={() => onAdd(place)}>
      {/* the sr-only span carries the whole name: browsers put a space before a trailing sr-only span, which would read "Add to trip : Name" */}
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">
        {label}: {place.name.en}
      </span>
    </button>
  );
}

/** `onAddToTrip` is passed only for places, so landmarks and culture items get no trip button. */
function ClaimList({ items, kindLabel, isInTrip, onAddToTrip }) {
  return (
    <ul className="grid">
      {items.map(item => (
        <li key={item.name.en} className="border-t border-rule py-3.5 first:border-t-0 first:pt-1">
          <p className="flex flex-wrap items-baseline gap-x-2 leading-snug">
            <span className="text-[1.08rem] font-semibold">{item.name.en}</span>
            {item.name.bn && (
              <span lang="bn" className="text-ink-2">
                {item.name.bn}
              </span>
            )}
            {/* the kind of place as a small chip at the end of the line, not as a label above the name */}
            <span className="ml-auto rounded-[4px] bg-sunk px-2 py-0.5 text-eyebrow text-ink-2 uppercase">{kindLabel(item)}</span>
          </p>
          <p className="mt-1 max-w-[60ch] text-[1rem] leading-relaxed text-ink-2">{item.note}</p>
          {item.address && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <p className="text-[0.85rem] text-ink-3">{item.address}</p>
              <a className="btn btn-quiet min-h-11 px-4 text-[0.88rem]" href={directionsUrl(item.name.en, item.address)} target="_blank" rel="noopener noreferrer">
                Directions
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M8 2h4v4M12 2 6 8M10 9v3H2V4h3" />
                </svg>
                <span className="sr-only"> to {item.name.en} in Google Maps (opens in a new tab)</span>
              </a>
              {onAddToTrip && <AddToTripButton place={item} inTrip={isInTrip(item.id)} onAdd={onAddToTrip} />}
            </div>
          )}
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
    <section className="mt-9">
      <h3 className="mb-2 flex items-baseline gap-2 border-b border-rule-strong pb-2 text-h3">
        {title}
        <span lang="bn" className="font-normal text-ink-3">
          {bn}
        </span>
      </h3>
      {children}
    </section>
  );
}

/** Places to go, loaded on first card open. Rendered inside the page keyed by district, so it remounts per district. */
function PlacesToGo({ id, isInTrip, onAddToTrip }) {
  const [places, setPlaces] = useState(null); // null while loading, false if the data could not load
  useEffect(() => {
    loadPlaces().then(all => setPlaces(all[id] ?? []), () => setPlaces(false));
  }, [id]);
  return (
    <Section title="Places to go" bn="দেখার জায়গা">
      {places === null && <p className="text-[0.9rem] text-ink-3">Loading places…</p>}
      {places === false && <p className="text-[0.9rem] text-ink-3">Places could not load.</p>}
      {places && <ClaimList items={places} kindLabel={item => item.category} isInTrip={isInTrip} onAddToTrip={onAddToTrip} />}
    </Section>
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

export default function DistrictCard({ details, isNew, exiting = false, headingRef, sheetRef, onClose, onSelect, isInTrip, onAddToTrip }) {
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
      className="sheet passport"
      data-exiting={exiting}
      inert={exiting}
    >
      {/* the passport cover, as a band: the drag handle (phones), what this is, and the way out */}
      <div className="cover">
        <div className="sheet-handle lg:hidden" aria-hidden="true" {...handleProps}>
          <span />
        </div>
        <div className="flex h-12 items-center justify-between gap-3 px-5 sm:px-7 lg:h-14">
          <p className="text-eyebrow uppercase">
            Passport page{' '}
            <span lang="bn" className="tracking-normal normal-case">
              পাসপোর্টের পাতা
            </span>
          </p>
          <button type="button" className="btn btn-quiet -mr-2 min-h-11 px-4 text-[0.85rem]" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <article key={id} className="passport-page passport-enter overflow-y-auto overscroll-contain px-5 pt-6 pb-7 sm:px-7">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="passport-title"
              ref={headingRef}
              tabIndex={-1}
              className={`${name.length > 9 ? 'text-[clamp(1.9rem,1.3rem+1.6vw,2.6rem)] leading-[1.05] font-bold tracking-[-0.015em]' : 'text-h1'} text-balance [overflow-wrap:anywhere]`}
            >
              {name}
            </h2>
            <p lang="bn" className="mt-1.5 text-[clamp(1.4rem,1rem+1.25vw,2rem)] leading-[1.3] font-medium text-ink-2">
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
        <PlacesToGo id={id} isInTrip={isInTrip} onAddToTrip={onAddToTrip} />
        {!content && (
          <div className="mt-9 border-t border-rule pt-4">
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
          <ul className="place-links">
            {neighbors.map(n => (
              <li key={n.id}>
                <button type="button" className="place-link" onClick={() => onSelect(n.id)}>
                  <span>{n.name}</span>
                  <span lang="bn" className="font-normal text-ink-3">
                    {n.bn}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>

        <p className="mt-6 text-[0.75rem] leading-relaxed text-ink-3">
          {content ? 'Every claim on this page links to the source it was checked against.' : 'Each place links to its source; area and borders come from the boundary data.'}
        </p>
      </article>
    </section>
  );
}

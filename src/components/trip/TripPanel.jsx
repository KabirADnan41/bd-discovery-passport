import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { formatBn, getDistrict } from '../../lib/districtData';
import { loadPlaces } from '../../lib/places';
import { addDay, dayDirectionsUrl, locationOf, moveStop, pruneUnknownPlaces, removeDay, removeStop } from '../../lib/trip';
import { dropTarget } from '../../lib/tripReorder';
import { SHARE_PARAM, encodeTripShare } from '../../lib/tripShare';
import SharedTripNotice from './SharedTripNotice';

const BUTTON = 'btn btn-quiet min-h-11 px-4 text-[0.88rem] aria-disabled:opacity-45';
const keyOf = stop => `${stop.kind}-${stop.id}`; // unique within a trip, and safe in an element id
const stopCount = trip => trip.days.flat().length;
const samePlace = (a, b) => a?.day === b?.day && a?.index === b?.index; // two { day, index }, either of which may be missing
// What every move announces, from a Move button or a drag.
const movedMessage = (names, to) => `Moved ${names.en} to day ${to.day + 1}, stop ${to.index + 1}.`;
// The link "Share trip" gives: this page with the trip's ids and nothing else from the address (no `district`, no other `trip`).
const shareLink = trip => `${window.location.origin}${window.location.pathname}?${SHARE_PARAM}=${encodeTripShare(trip)}`;

/** What a stop shows: a place's English and Bengali names and its district, or a district's own names. */
function namesOf(stop, placesById) {
  if (stop.kind === 'district') {
    const district = getDistrict(stop.id);
    return { en: district.name, bn: district.bn };
  }
  const place = placesById.get(stop.id); // missing only until an unknown place is pruned
  return { en: place?.name.en ?? stop.id, bn: place?.name.bn, district: getDistrict(stop.id.split('-')[0]).name };
}

/** Where Up (step -1) or Down (step 1) takes a stop: along its day, else to the end of the day before or the start of the day after. */
function moveTarget(days, day, index, step) {
  const along = index + step;
  if (along >= 0 && along < days[day].length) return { day, index: along };
  return { day: day + step, index: step < 0 ? (days[day - 1]?.length ?? 0) : 0 }; // moveStop refuses a day that is not there
}

/** A disabled button stays focusable (aria-disabled, not disabled) and a press does nothing. */
function TripButton({ id, label, fullLabel, disabled = false, onPress }) {
  return (
    <button id={id} type="button" className={BUTTON} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onPress}>
      {fullLabel ? (
        <>
          {/* as in AddToTripButton: the sr-only span carries the whole name, so it never reads "Move up : Name" */}
          <span aria-hidden="true">{label}</span>
          <span className="sr-only">{fullLabel}</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}

/**
 * One stop, its grip and its buttons. Focus follows by id: a moved stop keeps its button, a removed one hands over to
 * `focusAfterRemove`. `lifted` marks the stop being dragged, and `drop` ('before' or 'after') the edge where a drop line shows.
 */
function Stop({ trip, day, index, names, focusAfterRemove, onEdit, gripProps, lifted, drop }) {
  const key = keyOf(trip.days[day][index]);
  const moveButton = (step, label) => {
    const to = moveTarget(trip.days, day, index, step);
    const next = moveStop(trip, { day, index }, to);
    const id = `trip-${step < 0 ? 'up' : 'down'}-${key}`;
    return (
      <TripButton id={id} label={label} fullLabel={`${label}: ${names.en}`} disabled={next === trip} onPress={() => onEdit(next, movedMessage(names, to), id)} />
    );
  };
  return (
    <li className="trip-stop flex gap-2 border-t border-rule py-3.5 first:border-t-0 first:pt-1" data-lifted={lifted || undefined} data-drop={drop}>
      {/* pointers only: Move up and Move down are the way for keyboards and screen readers, so the grip is hidden and never focused */}
      <span className="trip-grip flex h-11 w-6 shrink-0 justify-center pt-1" aria-hidden="true" {...gripProps({ day, index }, names)}>
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
          {[2, 8, 14].map(cy => (
            <g key={cy}>
              <circle cx="2" cy={cy} r="1.5" />
              <circle cx="8" cy={cy} r="1.5" />
            </g>
          ))}
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 leading-snug">
          <span className="text-[1.08rem] font-semibold">{names.en}</span>
          {names.bn && (
            <span lang="bn" className="text-ink-2">
              {names.bn}
            </span>
          )}
        </p>
        {names.district && <p className="mt-0.5 text-[0.85rem] text-ink-3">{names.district}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {moveButton(-1, 'Move up')}
          {moveButton(1, 'Move down')}
          <TripButton
            id={`trip-remove-${key}`}
            label="Remove"
            fullLabel={`Remove: ${names.en}`}
            onPress={() => onEdit(removeStop(trip, day, index), `Removed ${names.en} from your trip.`, focusAfterRemove)}
          />
        </div>
      </div>
    </li>
  );
}

// Each day's block and its stop rows, top to bottom, as dropTarget takes them. In page coordinates, so a wheel scroll in the
// middle of a drag does not move the target.
const span = el => {
  const { top, bottom } = el.getBoundingClientRect();
  return { top: top + window.scrollY, bottom: bottom + window.scrollY };
};
const measureDays = () => [...document.querySelectorAll('.trip-day')].map(day => ({ ...span(day), rows: [...day.querySelectorAll('.trip-stop')].map(span) }));

/**
 * Drag to reorder, for pointers: a stop is held by its grip and dropped where moveStop puts it, saved through onEdit with the
 * Move buttons' announcement but no focus id, so focus stays where it was. `drag` is { pointerId, from, names, days, to } while a
 * stop is held, `to` being null unless a drop there would move it. Escape or a cancelled pointer drops nothing.
 * ponytail: no auto-scroll while dragging; a long move uses the Move buttons.
 */
function useStopDrag(trip, onEdit) {
  const [drag, setDrag] = useState(null);
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return undefined;
    const onKey = e => e.key === 'Escape' && setDrag(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dragging]);

  // The move a drop here would make, or null: off the days, back on its own place, or refused (into a full day).
  const moveAt = e => {
    const to = dropTarget(drag.days, e.pageY, drag.from);
    return to && !samePlace(to, drag.from) && moveStop(trip, drag.from, to) !== trip ? to : null;
  };
  const holds = e => drag?.pointerId === e.pointerId;
  const gripProps = (from, names) => ({
    onPointerDown: e => {
      if (!e.isPrimary || e.button !== 0) return; // one stop at a time, by the main button or the first finger
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ pointerId: e.pointerId, from, names, days: measureDays(), to: null });
    },
    onPointerMove: e => {
      if (!holds(e)) return;
      const to = moveAt(e);
      if (!samePlace(to, drag.to)) setDrag({ ...drag, to });
    },
    onPointerUp: e => {
      if (!holds(e)) return;
      const to = moveAt(e);
      setDrag(null);
      if (to) onEdit(moveStop(trip, drag.from, to), movedMessage(drag.names, to));
    },
    onPointerCancel: e => holds(e) && setDrag(null),
  });
  return { drag, gripProps };
}

/**
 * The trip planner. GameBoard owns the trip; `onEdit(nextTrip, announcement, focusId)` saves and announces every change,
 * `onShowOnMap(dayNumber)` takes a phone down to the map and `onAnnounce(message)` says anything else. `shared` is a shared
 * trip link GameBoard has checked ({ ok, trip }, or null), previewed above the planner until onSaveShared, onReplaceShared
 * (which asks first) or onDismissShared.
 */
export default function TripPanel({ trip, onEdit, onClear, onShowOnMap, onAnnounce, shared, onSaveShared, onReplaceShared, onDismissShared }) {
  const [placesById, setPlacesById] = useState(null); // null while loading, false if the data could not load
  useEffect(() => {
    loadPlaces().then(all => setPlacesById(new Map(Object.values(all).flat().map(p => [p.id, p]))), () => setPlacesById(false));
  }, []);

  // Places that are no longer in the data are dropped here, once it has loaded (never on app load), and saved only if there were any.
  useEffect(() => {
    if (!placesById) return;
    const pruned = pruneUnknownPlaces(trip, new Set(placesById.keys()));
    if (stopCount(pruned) < stopCount(trip)) onEdit(pruned);
  }, [placesById, trip, onEdit]);

  const { drag, gripProps } = useStopDrag(trip, onEdit);
  const [linkShown, setLinkShown] = useState(false); // after a copy fails, the link shows in a field instead
  const linkRef = useRef(null);
  const stops = trip.days.flat();
  const withDay = addDay(trip);
  // A shared trip's days in local names, by id, once the places have loaded; its own text is never shown. Null for a link
  // that is not valid.
  const sharedDays = placesById && shared?.ok ? shared.trip.days.map(day => day.map(stop => namesOf(stop, placesById).en)) : null;

  // Where the browser has no clipboard or refuses, the link shows in a field, selected, to copy by hand.
  const shareTrip = async () => {
    try {
      await navigator.clipboard.writeText(shareLink(trip));
      onAnnounce('Trip link copied.');
    } catch {
      flushSync(() => setLinkShown(true)); // the field is on screen before it is selected
      linkRef.current?.focus();
      linkRef.current?.select();
      onAnnounce('Copy the trip link below.');
    }
  };

  return (
    <>
      {shared && placesById && (
        <SharedTripNotice
          days={sharedDays}
          replaces={stops.length > 0}
          onSave={onSaveShared}
          onReplace={onReplaceShared}
          onDismiss={onDismissShared}
        />
      )}
      <section aria-labelledby="trip-title">
        <h2 id="trip-title" tabIndex={-1} className="flex flex-wrap items-baseline gap-x-3 text-h2">
          Your trip
          <span lang="bn" className="font-normal text-ink-3">
            আপনার ভ্রমণ
          </span>
        </h2>
        {placesById === null && <p className="mt-3 text-[0.9rem] text-ink-3">Loading your trip…</p>}
        {placesById === false && <p className="mt-3 text-[0.9rem] text-ink-3">Places could not load.</p>}
        {placesById && stops.length === 0 && (
          <p className="mt-3 max-w-[46ch] text-[1.0625rem] leading-relaxed text-ink-2">
            Your trip is empty. Open a district and choose “Add to trip” on a place to start.
          </p>
        )}
        {placesById && stops.length > 0 && (
          <>
            {trip.days.map((day, d) => {
              const url = dayDirectionsUrl(day, stop => locationOf(stop, placesById));
              // The drop line, on the rows as they stand (the held stop still in its place): on the top edge of the row the stop
              // would land before, on the bottom edge of the last row, or under the heading of an empty day.
              const before = drag?.to?.day === d ? drag.to.index + (d === drag.from.day && drag.to.index >= drag.from.index ? 1 : 0) : -1;
              const dropAt = i => (i === before ? 'before' : i === day.length - 1 && before === day.length ? 'after' : undefined);
              return (
                <section key={d} className="trip-day mt-7" data-drop={day.length === 0 && before === 0 ? 'start' : undefined}>
                  <h3 className="mb-2 flex items-baseline gap-2 border-b border-rule-strong pb-2 text-h3">
                    Day {d + 1}
                    <span lang="bn" className="font-normal text-ink-3">
                      দিন {formatBn(d + 1)}
                    </span>
                  </h3>
                  {day.length > 0 && (
                    <ol>
                      {day.map((stop, i) => {
                        const at = stops.indexOf(stop);
                        const neighbour = stops[at + 1] ?? stops[at - 1];
                        return (
                          <Stop
                            key={keyOf(stop)}
                            trip={trip}
                            day={d}
                            index={i}
                            names={namesOf(stop, placesById)}
                            focusAfterRemove={neighbour ? `trip-remove-${keyOf(neighbour)}` : 'trip-title'}
                            onEdit={onEdit}
                            gripProps={gripProps}
                            lifted={samePlace(drag?.from, { day: d, index: i })}
                            drop={dropAt(i)}
                          />
                        );
                      })}
                    </ol>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {url && (
                      <a className={BUTTON} href={url} target="_blank" rel="noopener noreferrer">
                        Directions
                        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M8 2h4v4M12 2 6 8M10 9v3H2V4h3" />
                        </svg>
                        <span className="sr-only"> for day {d + 1} in Google Maps (opens in a new tab)</span>
                      </a>
                    )}
                    {day.length > 0 && (
                      // phones only: from the desktop's two columns the map is already in view. The wrapper does the hiding, as .btn's
                      // own display would win over lg:hidden on the button itself.
                      <div className="lg:hidden">
                        <TripButton
                          id={`trip-show-map-${d + 1}`}
                          label="Show on map"
                          fullLabel={`Show on map: day ${d + 1}`}
                          onPress={() => onShowOnMap(d + 1)}
                        />
                      </div>
                    )}
                    {day.length === 0 && trip.days.length > 1 && (
                      <TripButton
                        label="Remove day"
                        fullLabel={`Remove day ${d + 1}`}
                        onPress={() => onEdit(removeDay(trip, d), `Removed day ${d + 1}.`, 'trip-title')}
                      />
                    )}
                  </div>
                </section>
              );
            })}
            <div className="mt-8 flex flex-wrap gap-2">
              <TripButton label="Add a day" disabled={withDay === trip} onPress={() => onEdit(withDay, `Added day ${withDay.days.length}.`)} />
              <TripButton label="Clear trip" onPress={onClear} />
              <TripButton label="Share trip" onPress={shareTrip} />
            </div>
            {linkShown && (
              <div className="mt-4 grid gap-1.5">
                <label htmlFor="trip-share-link" className="text-[0.9rem] font-medium">
                  Trip link
                </label>
                <input ref={linkRef} id="trip-share-link" className="field-input" readOnly value={shareLink(trip)} />
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

import { useEffect, useState } from 'react';
import { formatBn, getDistrict } from '../../lib/districtData';
import { loadPlaces } from '../../lib/places';
import { addDay, dayDirectionsUrl, locationOf, moveStop, pruneUnknownPlaces, removeDay, removeStop } from '../../lib/trip';

const BUTTON = 'btn btn-quiet min-h-11 px-4 text-[0.88rem] aria-disabled:opacity-45';
const keyOf = stop => `${stop.kind}-${stop.id}`; // unique within a trip, and safe in an element id
const stopCount = trip => trip.days.flat().length;

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

/** One stop and its buttons. Focus follows by id: a moved stop keeps its button, a removed one hands over to `focusAfterRemove`. */
function Stop({ trip, day, index, names, focusAfterRemove, onEdit }) {
  const key = keyOf(trip.days[day][index]);
  const moveButton = (step, label) => {
    const to = moveTarget(trip.days, day, index, step);
    const next = moveStop(trip, { day, index }, to);
    const id = `trip-${step < 0 ? 'up' : 'down'}-${key}`;
    const message = `Moved ${names.en} to day ${to.day + 1}, stop ${to.index + 1}.`;
    return <TripButton id={id} label={label} fullLabel={`${label}: ${names.en}`} disabled={next === trip} onPress={() => onEdit(next, message, id)} />;
  };
  return (
    <li className="border-t border-rule py-3.5 first:border-t-0 first:pt-1">
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
    </li>
  );
}

/** The trip planner. GameBoard owns the trip; `onEdit(nextTrip, announcement, focusId)` saves and announces every change. */
export default function TripPanel({ trip, onEdit, onClear }) {
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

  const stops = trip.days.flat();
  const withDay = addDay(trip);

  return (
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
            return (
              <section key={d} className="mt-7">
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
          </div>
        </>
      )}
    </section>
  );
}

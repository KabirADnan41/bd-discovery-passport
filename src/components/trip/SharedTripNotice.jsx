/**
 * What a shared trip link offers, above the planner: a preview of its days, or word that the link is not valid. `days`
 * holds each day's stop names, which TripPanel takes from the local place data by id (never text from the link), or is
 * null for a link that is not valid. Showing it stores nothing: the user saves the trip (`replaces` false, as there is no
 * trip here yet), replaces this browser's trip (GameBoard asks first), or dismisses it.
 */
export default function SharedTripNotice({ days, replaces, onSave, onReplace, onDismiss }) {
  return (
    <section aria-labelledby="shared-trip-title" className="mb-8 rounded-[12px] border border-rule-strong px-5 py-4">
      <h2 id="shared-trip-title" className="text-h3">
        A shared trip
      </h2>
      {days ? (
        <ol className="mt-2 grid gap-1 text-[1.0625rem] leading-snug">
          {days.map((names, d) => (
            <li key={d}>
              <span className="font-semibold">Day {d + 1}:</span> {names.join(' → ')}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-ink-2">This trip link is not valid, so nothing was loaded.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {days && (
          <button type="button" className="btn btn-solid" onClick={replaces ? onReplace : onSave}>
            {replaces ? 'Replace my trip' : 'Save this trip'}
          </button>
        )}
        <button type="button" className="btn btn-quiet" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </section>
  );
}

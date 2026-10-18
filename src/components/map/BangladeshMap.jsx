import { memo, useMemo, useState } from 'react';
import { DISTRICTS, MAP, getDistrict } from '../../lib/districtData';
import { isArrowKey, nextDistrictInDirection } from '../../lib/mapNavigation';
import DistrictTooltip from './DistrictTooltip';

const [, , VB_W, VB_H] = MAP.viewBox;
const DEFAULT_FOCUS_ID = '1'; // Dhaka: the first tab stop into the map
const PIN_RADIUS = 19; // viewBox units: with its outline a pin is about as wide as the gap between the two closest district anchors (41)

const focusDistrict = id => document.getElementById(`district-${id}`)?.focus();

// Fills never re-render on hover: only data-state / data-selected / tabIndex changes reach them. The group is the land: it
// carries the one landmass shadow (.map-land), so the overlays drawn above it stay crisp.
const DistrictLayer = memo(function DistrictLayer({ discoveredSet, selectedId, inkingId, tabbableId, marks, handlers }) {
  return (
    <g className="map-land">
      {DISTRICTS.map(d => {
        const discovered = discoveredSet.has(d.id);
        return (
          <path
            key={d.id}
            id={`district-${d.id}`}
            className="district"
            d={d.d}
            data-district-id={d.id}
            data-district-name={d.name}
            data-state={discovered ? 'discovered' : 'locked'}
            data-selected={d.id === selectedId}
            data-inking={d.id === inkingId || undefined}
            data-quiz={marks?.[d.id]}
            role="button"
            tabIndex={d.id === tabbableId ? 0 : -1}
            aria-label={`${d.name}, ${discovered ? 'discovered' : 'not yet discovered'}`}
            {...handlers}
          />
        );
      })}
    </g>
  );
});

// In quiz mode the map shows no district names (district aria-labels keep them) and Enter makes a guess.
// `tripMap` ({ pins, routes } from tripMapData) is passed in plan mode only: the trip is drawn at each district's own anchor, nowhere else.
// `justDiscoveredId` is the district just stamped for the first time: while it is selected it inks in once the stamp has landed.
export default function BangladeshMap({ discoveredSet, selectedId, justDiscoveredId, hoveredId, marks, tripMap, onHoverChange, onActivate }) {
  const quiz = marks !== undefined; // quiz marks are passed only in quiz mode
  const [focusedId, setFocusedId] = useState(null);
  const [keyboardFocusId, setKeyboardFocusId] = useState(null);
  const tabbableId = focusedId ?? selectedId ?? DEFAULT_FOCUS_ID;

  // One stable handler set shared by all 64 paths; the district id comes from data-district-id.
  const handlers = useMemo(() => {
    const idOf = e => e.currentTarget.dataset.districtId;
    return {
      onClick: e => onActivate(idOf(e), e.detail === 0 ? 'keyboard' : 'pointer'),
      onKeyDown: e => {
        const id = idOf(e);
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate(id, 'keyboard');
        } else if (isArrowKey(e.key)) {
          e.preventDefault();
          const next = nextDistrictInDirection(DISTRICTS, id, e.key);
          if (next) focusDistrict(next);
        }
      },
      onFocus: e => {
        const id = idOf(e);
        setFocusedId(id);
        setKeyboardFocusId(e.currentTarget.matches(':focus-visible') ? id : null);
      },
      onBlur: () => setKeyboardFocusId(null),
      onPointerEnter: e => e.pointerType === 'mouse' && onHoverChange(idOf(e)),
      onPointerLeave: () => onHoverChange(null),
    };
  }, [onActivate, onHoverChange]);

  const hovered = getDistrict(hoveredId);
  const selected = getDistrict(selectedId);
  const inkingId = selected && selected.id === justDiscoveredId ? selected.id : null;
  const keyboardFocused = getDistrict(keyboardFocusId);
  const tooltipDistrict = quiz ? null : (hovered ?? keyboardFocused);
  // Outside a quiz the hover copy is the district itself (its own fill), so it can lift; a quiz keeps a tint, as its marks must
  // show through. The focus ring rides on whichever copy is lifted under it.
  const hoverState = hovered && !quiz ? (discoveredSet.has(hovered.id) ? 'discovered' : 'locked') : undefined;
  const liftOf = id => (id === selectedId ? 'selected' : hoverState && id === hoveredId ? 'hover' : undefined);

  return (
    <div className="map-canvas" style={{ '--map-ratio': VB_W / VB_H }}>
      <svg
        className="map-svg"
        viewBox={MAP.viewBox.join(' ')}
        role="group"
        aria-labelledby="map-title"
        aria-describedby="map-instructions"
      >
        <title id="map-title">Map of the 64 districts of Bangladesh</title>
        <defs>
          <pattern id="hatch-locked" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect className="hatch-bg" width="6" height="6" />
            <line className="hatch-line" x1="0" y1="0" x2="0" y2="6" />
          </pattern>
        </defs>

        <path className="map-graticule" d={MAP.graticule} />
        <g aria-hidden="true">
          {MAP.graticuleLabels.map(l => (
            <text
              key={l.text}
              className="map-annotation"
              x={l.x}
              y={l.y}
              textAnchor={l.axis === 'lat' ? 'start' : 'middle'}
              dominantBaseline={l.axis === 'lat' ? 'middle' : 'auto'}
            >
              {l.text}
            </text>
          ))}
          {MAP.contextLabels.map(c => (
            <text key={c.key} className="map-context" data-water={c.water} x={c.x} y={c.y} textAnchor={c.anchor}>
              {c.en}
              <tspan className="map-context-bn" lang="bn" x={c.x} dy="1.3em">
                {c.bn}
              </tspan>
            </text>
          ))}
        </g>

        <DistrictLayer
          discoveredSet={discoveredSet}
          selectedId={selectedId}
          inkingId={inkingId}
          tabbableId={tabbableId}
          marks={marks}
          handlers={handlers}
        />

        <path className="map-division" d={MAP.divisionBorders} />
        <path className="map-outline" d={MAP.outline} />

        {hovered && hovered.id !== selectedId && (
          <path key={`h${hovered.id}`} className="overlay-hover" data-state={hoverState} d={hovered.d} />
        )}
        {/* the selected district locks: a filled copy under its paper rim and stamp outline, lifted together; a click on a
            lifted hover copy carries on from where that copy was (data-from-hover). A district stamped for the first time keeps
            the hatch (data-inking) until its ink spreads over the copy. */}
        {selected && (
          <g
            key={`s${selected.id}`}
            className="overlay-selection"
            data-from-hover={selected.id === hoveredId || undefined}
            data-inking={inkingId || undefined}
          >
            <path className="overlay-selected-lift" d={selected.d} />
            {inkingId && <path className="overlay-selected-ink" d={selected.d} />}
            <path className="overlay-selected-halo" d={selected.d} />
            <path className="overlay-selected" d={selected.d} />
          </g>
        )}
        {tripMap && (
          <g className="trip-overlay" aria-hidden="true">
            {tripMap.routes.map(
              (route, day) =>
                route.length > 1 && <polyline key={day} data-trip-day={day + 1} points={route.map(id => getDistrict(id).label.join(',')).join(' ')} />,
            )}
            {tripMap.pins.map(({ districtId, count }) => {
              const [x, y] = getDistrict(districtId).label;
              return (
                <g key={districtId} data-trip-pin={districtId} data-count={count}>
                  <circle cx={x} cy={y} r={PIN_RADIUS} />
                  {count > 1 && (
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="central">
                      {count}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        )}
        {keyboardFocused && <path className="overlay-focus" data-lift={liftOf(keyboardFocused.id)} d={keyboardFocused.d} />}
      </svg>

      <DistrictTooltip district={tooltipDistrict} discovered={tooltipDistrict ? discoveredSet.has(tooltipDistrict.id) : false} />
      <p id="map-instructions" className="sr-only">
        Use the arrow keys to move between neighbouring districts.{' '}
        {quiz ? 'Press Enter or Space to guess a district.' : 'Press Enter or Space to discover a district and open its passport page.'}
      </p>
    </div>
  );
}


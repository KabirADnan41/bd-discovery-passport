import { memo, useMemo, useState } from 'react';
import { DISTRICTS, MAP, getDistrict } from '../../lib/districtData';
import { isArrowKey, nextDistrictInDirection } from '../../lib/mapNavigation';
import DistrictTooltip from './DistrictTooltip';

const [, , VB_W, VB_H] = MAP.viewBox;
const DEFAULT_FOCUS_ID = '1'; // Dhaka: the first tab stop into the map

const focusDistrict = id => document.getElementById(`district-${id}`)?.focus();

// Fills never re-render on hover: only data-state / data-selected / tabIndex changes reach them.
const DistrictLayer = memo(function DistrictLayer({ discoveredSet, selectedId, tabbableId, handlers }) {
  return (
    <g>
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

export default function BangladeshMap({ discoveredSet, selectedId, hoveredId, onHoverChange, onActivate, children }) {
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
  const keyboardFocused = getDistrict(keyboardFocusId);
  const tooltipDistrict = hovered ?? keyboardFocused;

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

        <DistrictLayer discoveredSet={discoveredSet} selectedId={selectedId} tabbableId={tabbableId} handlers={handlers} />

        <path className="map-division" d={MAP.divisionBorders} />
        <path className="map-outline" d={MAP.outline} />

        {hovered && hovered.id !== selectedId && <path key={`h${hovered.id}`} className="overlay-hover" d={hovered.d} />}
        {selected && (
          <g key={`s${selected.id}`}>
            <path className="overlay-selected-halo" d={selected.d} />
            <path className="overlay-selected" d={selected.d} />
          </g>
        )}
        {keyboardFocused && <path className="overlay-focus" d={keyboardFocused.d} />}
      </svg>

      {children}
      <DistrictTooltip district={tooltipDistrict} discovered={tooltipDistrict ? discoveredSet.has(tooltipDistrict.id) : false} />
      <p id="map-instructions" className="sr-only">
        Use the arrow keys to move between neighbouring districts. Press Enter or Space to discover a district and open its passport page.
      </p>
    </div>
  );
}


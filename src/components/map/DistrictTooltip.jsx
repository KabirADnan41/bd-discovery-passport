import { MAP } from '../../lib/districtData';

const [, , VB_W, VB_H] = MAP.viewBox;

// Anchored to the district's label point (not the cursor), so it never chases the pointer.
// Not keyed by district: it enters once, then moves between districts without replaying.
export default function DistrictTooltip({ district, discovered }) {
  if (!district) return null;
  const x = (district.label[0] / VB_W) * 100;
  const y = (district.label[1] / VB_H) * 100;
  // keep the bubble inside the map near the edges
  const shiftX = x < 14 ? '-12%' : x > 86 ? '-88%' : '-50%';
  const below = y < 9;
  return (
    <div
      className="map-tooltip"
      aria-hidden="true"
      style={{ left: `${x}%`, top: `${y}%`, translate: `${shiftX} ${below ? '14px' : 'calc(-100% - 12px)'}` }}
    >
      <span className="block text-[0.95rem] leading-tight font-semibold">
        {district.name}{' '}
        <span lang="bn" className="font-normal opacity-80">
          {district.bn}
        </span>
      </span>
      <span className="mt-1 block text-[0.7rem] leading-none tracking-[0.1em] uppercase opacity-75">
        {discovered ? 'Discovered' : 'Not yet discovered'}
      </span>
    </div>
  );
}

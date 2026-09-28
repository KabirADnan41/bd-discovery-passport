import { useId } from 'react';

// Deterministic per-district tilt between -11° and +7°: every stamp lands a little differently.
const stampRotation = id => ((Number(id) * 37) % 19) - 11;

/**
 * Rubber-stamp impression drawn in SVG. The ink texture is an SVG filter (speckled gaps plus a
 * tiny displacement) rather than a raster grunge image.
 */
export default function PassportStamp({ id, code, name, bn, division, size = 128, impact = false }) {
  const uid = useId().replace(/:/g, '');
  const top = `${uid}-top`;
  const bottom = `${uid}-bottom`;
  const ink = `${uid}-ink`;
  const seed = Number(id);

  return (
    <svg
      viewBox="0 0 140 140"
      width={size}
      height={size}
      role="img"
      aria-label={`Passport stamp: ${name}, ${division} Division`}
      className={`stamp shrink-0 ${impact ? 'stamp-impact' : ''}`}
      style={{ '--stamp-rot': `${stampRotation(id)}deg`, transform: 'rotate(var(--stamp-rot))' }}
    >
      <defs>
        <path id={top} d="M 22 70 A 48 48 0 0 1 118 70" />
        <path id={bottom} d="M 14 70 A 56 56 0 0 0 126 70" />
        <filter id={ink} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3 0 0 0 2.6" result="speckle" />
          <feComposite in="SourceGraphic" in2="speckle" operator="in" result="inked" />
          <feDisplacementMap in="inked" in2="noise" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${ink})`} fill="currentColor" stroke="currentColor">
        <circle cx="70" cy="70" r="65" fill="none" strokeWidth="3.2" />
        <circle cx="70" cy="70" r="60.5" fill="none" strokeWidth="0.9" />
        <circle cx="70" cy="70" r="41" fill="none" strokeWidth="0.9" />
        <text fontSize="10.5" fontWeight="600" letterSpacing="2.4" stroke="none">
          <textPath href={`#${top}`} startOffset="50%" textAnchor="middle">
            BANGLADESH
          </textPath>
        </text>
        <text fontSize="9" fontWeight="600" letterSpacing="1.6" stroke="none">
          <textPath href={`#${bottom}`} startOffset="50%" textAnchor="middle">
            {`${division.toUpperCase()} DIVISION`}
          </textPath>
        </text>
        <text x="70" y="73" fontSize="27" fontWeight="700" letterSpacing="2.5" textAnchor="middle" stroke="none">
          {code}
        </text>
        <text x="70" y="93" fontSize="13.5" fontWeight="500" textAnchor="middle" stroke="none" lang="bn">
          {bn}
        </text>
        <line x1="50" y1="80" x2="90" y2="80" strokeWidth="0.9" />
      </g>
    </svg>
  );
}

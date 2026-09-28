// Swatches reuse the map's own hatch pattern and tokens, so the key always matches the map.
const Swatch = ({ children }) => (
  <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true" className="shrink-0">
    {children}
  </svg>
);

const ITEMS = [
  {
    en: 'Not yet discovered',
    bn: 'অনাবিষ্কৃত',
    swatch: <rect x="0.5" y="0.5" width="21" height="13" rx="2" className="district" data-state="locked" />,
  },
  {
    en: 'Discovered',
    bn: 'আবিষ্কৃত',
    swatch: <rect x="0.5" y="0.5" width="21" height="13" rx="2" className="district" data-state="discovered" />,
  },
  {
    en: 'Open passport page',
    bn: 'খোলা পাতা',
    swatch: <rect x="1.5" y="1.5" width="19" height="11" rx="2" className="overlay-selected" />,
  },
  {
    en: 'Division border',
    bn: 'বিভাগের সীমানা',
    swatch: <line x1="1" y1="7" x2="21" y2="7" className="map-division" />,
  },
];

export default function MapLegend({ className = '' }) {
  return (
    <ul className={`grid gap-1.5 text-[0.8rem] text-ink-2 ${className}`} aria-label="Map key">
      {ITEMS.map(item => (
        <li key={item.en} className="flex items-center gap-2">
          <Swatch>{item.swatch}</Swatch>
          <span>
            {item.en}{' '}
            <span lang="bn" className="text-ink-3">
              {item.bn}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

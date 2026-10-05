// Swatches reuse the map's own hatch pattern and tokens, so the key always matches the map.
const Swatch = ({ children }) => (
  <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true" className="shrink-0">
    {children}
  </svg>
);

const areaSwatch = props => <rect x="0.5" y="0.5" width="21" height="13" rx="2" className="district" {...props} />;

const EXPLORE_ITEMS = [
  { en: 'Not yet discovered', bn: 'অনাবিষ্কৃত', swatch: areaSwatch({ 'data-state': 'locked' }) },
  { en: 'Discovered', bn: 'আবিষ্কৃত', swatch: areaSwatch({ 'data-state': 'discovered' }) },
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

// Same tokens as the quiz marks in index.css; no data-quiz here, so only the map carries quiz marks.
const QUIZ_ITEMS = [
  { en: 'Correct', bn: 'সঠিক', swatch: areaSwatch({ style: { fill: 'var(--map-discovered)' } }) },
  { en: 'Wrong guess', bn: 'ভুল', swatch: areaSwatch({ style: { fill: 'var(--map-wrong)' } }) },
  { en: 'Answer shown', bn: 'উত্তর', swatch: areaSwatch({ style: { fill: 'var(--accent-brass)' } }) },
];

// One line of text under the map, not a box.
export default function MapLegend({ quiz = false, className = '' }) {
  return (
    <ul className={`flex w-full flex-wrap gap-x-5 gap-y-1.5 text-[0.85rem] text-ink-3 lg:justify-center ${className}`} aria-label="Map key">
      {(quiz ? QUIZ_ITEMS : EXPLORE_ITEMS).map(item => (
        <li key={item.en} className="flex items-center gap-2">
          <Swatch>{item.swatch}</Swatch>
          <span>
            {item.en}{' '}
            <span lang="bn">{item.bn}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

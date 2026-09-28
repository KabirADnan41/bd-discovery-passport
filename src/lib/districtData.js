import map from '../generated/districtPaths.generated.json';
import enriched from '../data/districts.enriched.json';

export const MAP = map;
export const DISTRICTS = map.districts;
export const TOTAL_DISTRICTS = DISTRICTS.length;
export const DISTRICT_IDS = new Set(DISTRICTS.map(d => d.id));

const districtById = new Map(DISTRICTS.map(d => [d.id, d]));
const divisionById = new Map(map.divisions.map(d => [d.id, d]));

/** Divisions in source order, each with its districts sorted by English name. */
export const DIVISIONS = map.divisions.map(division => ({
  ...division,
  districts: DISTRICTS.filter(d => d.divisionId === division.id).sort((a, b) => a.name.localeCompare(b.name)),
}));

export function getDistrict(id) {
  return districtById.get(id) ?? null;
}

/** Everything the passport card needs. Content is null unless curated and verified. */
export function getDistrictDetails(id) {
  const district = districtById.get(id);
  if (!district) return null;
  const entry = enriched[id];
  const content = entry && entry.contentStatus === 'verified' ? entry : null;
  return {
    ...district,
    division: divisionById.get(district.divisionId),
    stampCode: entry?.stamp?.code ?? district.code,
    content,
    neighbors: district.neighbors.map(n => districtById.get(n)),
  };
}

/** Districts with verified content, for the "where to begin" suggestions. */
export const FEATURED_IDS = ['1', '45', '54', '64'].filter(id => enriched[id]?.contentStatus === 'verified');

const bnNumber = new Intl.NumberFormat('bn-BD');
const enNumber = new Intl.NumberFormat('en');
/** Bengali numerals via Intl (e.g. 1479 → ১,৪৭৯). */
export const formatBn = value => bnNumber.format(value);
export const formatEn = value => enNumber.format(value);

export const formatCoord = (lat, lon) => `${lat.toFixed(2)}°N ${lon.toFixed(2)}°E`;

#!/usr/bin/env node
/**
 * Build the 64-district SVG map from upazila-level (ADM3) boundaries.
 *
 *   ADM3 polygons (544) ── district_id join (426) ─┐
 *                        └─ spatial join vs ADM2 (118 orphans) ─┴─► 64 groups
 *   → TopoJSON topology (shared arcs) → simplify arcs once → merge (dissolve) per district
 *   → Transverse Mercator, central meridian 90°E → SVG path data
 *
 * Output: src/generated/districtPaths.generated.json (+ data/map-build-report.json)
 * Any unexpected inconsistency throws, so `npm run build:map` exits non-zero.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { geoTransverseMercator, geoPath, geoGraticule, geoArea, geoBounds } from 'd3-geo';
import { topology } from 'topojson-server';
import { merge, mesh, neighbors } from 'topojson-client';
import { presimplify, simplify, quantile, sphericalTriangleArea } from 'topojson-simplify';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'data', 'source');
const OUT = path.join(ROOT, 'src', 'generated', 'districtPaths.generated.json');
const REPORT = path.join(ROOT, 'data', 'map-build-report.json');

// Tunables (documented in docs/data-sources.md).
const QUANTIZATION = 1e5;          // ~5 m grid across Bangladesh; snaps near-identical vertices so neighbours share arcs
const SIMPLIFY_KEEP = 0.25;        // keep the 25% most significant arc vertices (Visvalingam, spherical area); visually checked at 1x and 2.4x
const VIEW_WIDTH = 1000;           // SVG user units
const PAD = { top: 40, right: 70, bottom: 70, left: 70 };
const DIGITS = 1;                  // path coordinate decimals (0.1 unit ≈ 70 m on the ground)
const EARTH_RADIUS_KM = 6371.0088;
const MAX_HOLE_KM2 = 1;            // interior rings smaller than this are topology slivers, not real enclaves

const warnings = [];
const fail = msg => { throw new Error(`build-district-map: ${msg}`); };

// ---------------------------------------------------------------- inputs
const lock = JSON.parse(fs.readFileSync(path.join(SRC, 'sources.json'), 'utf8'));
const read = name => {
  const buf = fs.readFileSync(path.join(SRC, name));
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  if (hash !== lock.files[name]?.sha256) fail(`${name} SHA-256 ${hash} does not match data/source/sources.json`);
  return { json: JSON.parse(buf.toString('utf8')), bytes: buf.length };
};
const adm3 = read('bangladesh.geojson');
const adm2 = read('geoBoundaries-BGD-ADM2_simplified.geojson');
const { districts } = read('bd-districts.json').json;
const { divisions } = read('bd-divisions.json').json;

// ---------------------------------------------------------------- metadata integrity
if (divisions.length !== 8) fail(`expected 8 divisions, got ${divisions.length}`);
if (districts.length !== 64) fail(`expected 64 districts, got ${districts.length}`);
const divisionById = new Map(divisions.map(d => [d.id, d]));
const districtById = new Map(districts.map(d => [d.id, d]));
if (districtById.size !== 64) fail('duplicate district ids in bd-districts.json');
for (const d of districts) {
  if (!d.id || !d.name || !d.bn_name) fail(`district ${JSON.stringify(d)} missing id/name/bn_name`);
  if (!divisionById.has(d.division_id)) fail(`district ${d.id} references unknown division ${d.division_id}`);
}

// ---------------------------------------------------------------- planar geometry helpers (lon/lat plane)
const polygonsOf = g => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : fail(`unsupported geometry ${g.type}`));
const ringArea = r => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return s / 2; }; // >0 = counter-clockwise (x east, y north)

function pointInGeometry([x, y], g) {
  let inside = false;
  for (const poly of polygonsOf(g)) for (const ring of poly) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

// A point guaranteed inside the largest part: widest interior span on a horizontal scanline.
function interiorPoint(polys, rows = 7) {
  const poly = polys.reduce((a, b) => (Math.abs(ringArea(b[0])) > Math.abs(ringArea(a[0])) ? b : a));
  const ys = poly[0].map(p => p[1]);
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  let best = null;
  for (let k = 1; k <= rows; k++) {
    const y = y0 + ((y1 - y0) * k) / (rows + 1);
    const xs = [];
    for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y)) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const w = xs[i + 1] - xs[i];
      // prefer wide spans near the vertical middle
      const score = w * (1 - Math.abs(k - (rows + 1) / 2) / (rows + 1));
      if (!best || score > best.score) best = { score, p: [(xs[i] + xs[i + 1]) / 2, y] };
    }
  }
  if (!best) fail('could not find an interior point');
  return best.p;
}

// d3-geo wants exterior rings clockwise and holes counter-clockwise (opposite of RFC 7946).
function rewindForD3(g) {
  const fix = poly => poly.map((ring, i) => {
    const cw = ringArea(ring) < 0;
    return (i === 0) === cw ? ring : [...ring].reverse();
  });
  return g.type === 'Polygon' ? { type: 'Polygon', coordinates: fix(g.coordinates) } : { type: 'MultiPolygon', coordinates: g.coordinates.map(fix) };
}

// ---------------------------------------------------------------- ADM2 name → district id
const norm = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '');
const ADM2_ALIASES = { // geoBoundaries spelling → bd-districts.json spelling (normalized)
  barisal: 'barishal', bogra: 'bogura', brahamanbaria: 'brahmanbaria', chittagong: 'chattogram', comilla: 'cumilla',
  jessore: 'jashore', khagrachhari: 'khagrachari', netrakona: 'netrokona', sirajganj: 'sirajgonj',
};
const districtByNorm = new Map(districts.map(d => [norm(d.name), d]));
const adm2Districts = adm2.json.features.map(f => {
  const n = norm(f.properties.shapeName);
  const d = districtByNorm.get(ADM2_ALIASES[n] || n);
  if (!d) fail(`ADM2 "${f.properties.shapeName}" has no match in bd-districts.json`);
  return { id: d.id, geometry: f.geometry };
});
if (new Set(adm2Districts.map(a => a.id)).size !== 64) fail('ADM2 → district mapping is not one-to-one');
const spatialDistrict = pt => adm2Districts.filter(a => pointInGeometry(pt, a.geometry)).map(a => a.id);

// ---------------------------------------------------------------- assign every ADM3 polygon to a district
const { corrections } = JSON.parse(fs.readFileSync(path.join(SRC, 'corrections.json'), 'utf8'));
const correctionKey = (name, from, to) => `${name}|${from}|${to}`;
const pendingCorrections = new Map(corrections.map(c => [correctionKey(c.sourceName, c.repositoryDistrictId, c.correctedDistrictId), c]));
const applied = [];
const assigned = [];
const orphans = [];
const disagreements = [];
for (const f of adm3.json.features) {
  if (!f.geometry || !polygonsOf(f.geometry).length) fail(`ADM3 "${f.properties.source_name}" has empty geometry`);
  const pt = interiorPoint(polygonsOf(f.geometry));
  const hits = spatialDistrict(pt);
  if (hits.length > 1) fail(`ADM3 "${f.properties.source_name}" interior point falls in ${hits.length} ADM2 districts`);
  const spatial = hits[0] ?? null;
  const joined = f.properties.district_id || null;

  if (joined) {
    if (!districtById.has(joined)) fail(`ADM3 "${f.properties.name}" has unknown district_id ${joined}`);
    if (f.properties.division_id !== districtById.get(joined).division_id) fail(`ADM3 "${f.properties.name}" division_id disagrees with its district`);
    if (!spatial) warnings.push(`"${f.properties.name}" (joined to ${joined}) interior point is outside every ADM2 polygon; kept the repository join`);
    if (spatial && spatial !== joined) {
      const key = correctionKey(f.properties.source_name, joined, spatial);
      const c = pendingCorrections.get(key);
      if (!c) { disagreements.push({ name: f.properties.source_name, joined, spatial }); continue; }
      pendingCorrections.delete(key);
      applied.push(c);
      assigned.push({ f, districtId: spatial, method: 'reviewed correction' });
      continue;
    }
    assigned.push({ f, districtId: joined, method: 'repository district_id' });
  } else {
    if (!spatial) fail(`orphan ADM3 "${f.properties.source_name}" could not be placed inside any ADM2 district`);
    orphans.push({ name: f.properties.source_name, districtId: spatial });
    assigned.push({ f, districtId: spatial, method: 'spatial join (ADM2)' });
  }
}
// The repository join is authoritative. A disagreement means either the name-matcher or our method is wrong, so stop.
if (disagreements.length) fail(`repository district_id disagrees with ADM2 for ${disagreements.length} polygons (review, then add to data/source/corrections.json): ${JSON.stringify(disagreements)}`);
if (pendingCorrections.size) fail(`stale corrections no longer match the source: ${JSON.stringify([...pendingCorrections.values()])}`);
const perDistrict = new Map();
for (const a of assigned) perDistrict.set(a.districtId, (perDistrict.get(a.districtId) || 0) + 1);
const missing = districts.filter(d => !perDistrict.has(d.id));
if (missing.length) fail(`districts with no geometry: ${missing.map(d => d.name).join(', ')}`);

// ---------------------------------------------------------------- topology, simplify, dissolve
const fc = { type: 'FeatureCollection', features: assigned.map(({ f, districtId }) => ({ type: 'Feature', properties: { districtId, divisionId: districtById.get(districtId).division_id }, geometry: f.geometry })) };
let topo = topology({ units: fc }, QUANTIZATION);
const arcPointsBefore = topo.arcs.reduce((n, a) => n + a.length, 0);
topo = presimplify(topo, sphericalTriangleArea);
const minWeight = quantile(topo, SIMPLIFY_KEEP); // weight that retains SIMPLIFY_KEEP of the points
topo = simplify(topo, minWeight);
const arcPointsAfter = topo.arcs.reduce((n, a) => n + a.length, 0);

const units = topo.objects.units.geometries;
const unitsByDistrict = new Map();
units.forEach((g, i) => { const id = g.properties.districtId; if (!unitsByDistrict.has(id)) unitsByDistrict.set(id, []); unitsByDistrict.get(id).push(i); });

// District adjacency from shared arcs between ADM3 units.
const adjacency = new Map(districts.map(d => [d.id, new Set()]));
neighbors(units).forEach((ns, i) => ns.forEach(j => {
  const a = units[i].properties.districtId, b = units[j].properties.districtId;
  if (a !== b) { adjacency.get(a).add(b); adjacency.get(b).add(a); }
}));

let slivers = 0;
const dissolved = new Map();
for (const d of districts) {
  const merged = merge(topo, unitsByDistrict.get(d.id).map(i => units[i]));
  // drop topology slivers (tiny interior rings); report any real hole
  merged.coordinates = merged.coordinates.map(poly => poly.filter((ring, i) => {
    if (i === 0) return true;
    const km2 = Math.min(geoArea({ type: 'Polygon', coordinates: [ring] }), geoArea({ type: 'Polygon', coordinates: [[...ring].reverse()] })) * EARTH_RADIUS_KM ** 2;
    if (km2 < MAX_HOLE_KM2) { slivers++; return false; }
    warnings.push(`${d.name}: kept a ${km2.toFixed(1)} km² interior ring (possible enclave)`);
    return true;
  }));
  if (!merged.coordinates.length) fail(`${d.name} dissolved to empty geometry`);
  const geometry = rewindForD3(merged);
  const steradians = geoArea(geometry);
  if (!(steradians > 0 && steradians < 1e-3)) fail(`${d.name} has implausible area (${steradians} sr); winding is wrong`);
  dissolved.set(d.id, geometry);
}

// ---------------------------------------------------------------- projection & SVG paths
const country = { type: 'Feature', geometry: rewindForD3(merge(topo, units)) };
const projection = geoTransverseMercator().rotate([-90, 0]); // Bangladesh Transverse Mercator uses central meridian 90°E
projection.fitWidth(VIEW_WIDTH - PAD.left - PAD.right, country);
const [[bx0, by0], [, by1]] = geoPath(projection).bounds(country);
projection.translate([projection.translate()[0] + PAD.left - bx0, projection.translate()[1] + PAD.top - by0]);
const VIEW_HEIGHT = Math.ceil(by1 - by0 + PAD.top + PAD.bottom);
projection.precision(0); // no adaptive resampling: the source is already dense enough at this scale
const pathGen = geoPath(projection);
const SCALE = 10 ** DIGITS;
const round = v => Math.round(v * SCALE) / SCALE;

// Compact SVG path: absolute M per ring, then relative l-deltas between rounded points.
// Rings under MIN_RING_AREA (sub-pixel specks) are dropped and counted.
const MIN_RING_AREA = 1; // square view units (~0.3 km²)
let specksDropped = 0;
const fmt = v => String(v / SCALE).replace(/^(-?)0\./, '$1.');
function compactPath(geojson, { polygon }) {
  const rings = [];
  let ring = null;
  geoPath(projection, {
    moveTo(x, y) { ring = [[Math.round(x * SCALE), Math.round(y * SCALE)]]; rings.push(ring); },
    lineTo(x, y) { const p = [Math.round(x * SCALE), Math.round(y * SCALE)], q = ring[ring.length - 1]; if (p[0] !== q[0] || p[1] !== q[1]) ring.push(p); },
    closePath() {},
  })(geojson);
  let d = '';
  for (const r of rings) {
    if (polygon) {
      if (r.length < 3 || Math.abs(ringArea(r)) / SCALE ** 2 < MIN_RING_AREA) { specksDropped++; continue; }
    } else if (r.length < 2) continue;
    d += `M${fmt(r[0][0])} ${fmt(r[0][1])}l`;
    for (let i = 1; i < r.length; i++) {
      for (const v of [r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]]) {
        const s = fmt(v);
        d += (d.endsWith('l') || s.startsWith('-') ? '' : ' ') + s;
      }
    }
    if (polygon) d += 'z';
  }
  return d;
}

const outline = compactPath(mesh(topo, topo.objects.units, (a, b) => a === b), { polygon: false });
const divisionBorders = compactPath(mesh(topo, topo.objects.units, (a, b) => a !== b && a.properties.divisionId !== b.properties.divisionId), { polygon: false });

const graticule = compactPath(geoGraticule().extent([[86, 19], [95, 28]]).step([1, 1]).precision(0.25)(), { polygon: false });
const [[lon0, lat0], [lon1, lat1]] = geoBounds(country);
const graticuleLabels = [];
for (let lat = Math.ceil(lat0); lat <= Math.floor(lat1); lat++) {
  const [, y] = projection([lon0 - 0.35, lat]);
  graticuleLabels.push({ text: `${lat}°N`, x: 8, y: round(y), axis: 'lat' });
}
for (let lon = Math.ceil(lon0); lon <= Math.floor(lon1); lon++) {
  const [x] = projection([lon, lat0 - 0.2]);
  graticuleLabels.push({ text: `${lon}°E`, x: round(x), y: VIEW_HEIGHT - 12, axis: 'lon' });
}

// Context labels outside Bangladesh; each is checked to be outside the country and inside the view.
const CONTEXT = [
  { key: 'india-west', en: 'India', bn: 'ভারত', at: [88.25, 23.1] },
  { key: 'india-north', en: 'India', bn: 'ভারত', at: [90.6, 26.0] },
  { key: 'myanmar', en: 'Myanmar', bn: 'মিয়ানমার', at: [92.5, 20.95], anchor: 'start' },
  { key: 'bay', en: 'Bay of Bengal', bn: 'বঙ্গোপসাগর', at: [90.2, 21.05], water: true },
];
const contextLabels = CONTEXT.map(c => {
  if (pointInGeometry(c.at, country.geometry)) fail(`context label ${c.key} sits inside Bangladesh`);
  const [x, y] = projection(c.at);
  if (x < 0 || x > VIEW_WIDTH || y < 0 || y > VIEW_HEIGHT) fail(`context label ${c.key} falls outside the view box`);
  return { key: c.key, en: c.en, bn: c.bn, x: round(x), y: round(y), anchor: c.anchor || 'middle', water: Boolean(c.water) };
});

// Passport stamp codes: first letter + two later consonants, first unused combination in id order.
const usedCodes = new Set();
const stampCode = name => {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '');
  const rest = [...letters.slice(1)];
  const cons = rest.filter(ch => !'AEIOU'.includes(ch));
  for (const pool of [cons, rest]) for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
    const code = letters[0] + pool[i] + pool[j];
    if (!usedCodes.has(code)) { usedCodes.add(code); return code; }
  }
  fail(`no unique stamp code for ${name}`);
};
const codes = new Map([...districts].sort((a, b) => a.id - b.id).map(d => [d.id, stampCode(d.name)]));

const out = {
  meta: {
    title: 'Bangladesh districts (64), dissolved from ADM3',
    attribution: 'Boundaries © geoBoundaries (gbOpen BGD ADM3/ADM2, CC BY 4.0; authority BBS / OCHA ROAP) via ifahimreza/bangladesh-geojson (MIT district metadata).',
    projection: 'Transverse Mercator, central meridian 90°E (d3-geo geoTransverseMercator)',
    simplification: `TopoJSON shared-arc Visvalingam (spherical triangle area), kept ${Math.round(SIMPLIFY_KEEP * 100)}% of weighted vertices, quantization ${QUANTIZATION}`,
  },
  viewBox: [0, 0, VIEW_WIDTH, VIEW_HEIGHT],
  outline, divisionBorders, graticule, graticuleLabels, contextLabels,
  divisions: divisions.map(v => ({ id: v.id, name: v.name, bn: v.bn_name })),
  districts: districts.map(d => {
    const geometry = dissolved.get(d.id);
    const projected = polygonsOf(geometry).map(poly => poly.map(ring => ring.map(p => projection(p))));
    const [lx, ly] = interiorPoint(projected);
    const [[x0, y0], [x1, y1]] = pathGen.bounds(geometry);
    const dPath = compactPath(geometry, { polygon: true });
    if (!dPath || dPath.length < 20) fail(`${d.name} produced empty SVG path`);
    return {
      id: d.id,
      divisionId: d.division_id,
      name: d.name,
      bn: d.bn_name,
      code: codes.get(d.id),
      lat: Number(d.lat),
      lon: Number(d.long),
      areaKm2: Math.round(geoArea(geometry) * EARTH_RADIUS_KM ** 2),
      parts: polygonsOf(geometry).length,
      label: [round(lx), round(ly)],
      bbox: [round(x0), round(y0), round(x1), round(y1)],
      neighbors: [...adjacency.get(d.id)].sort((a, b) => a - b),
      d: dPath,
    };
  }),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const json = JSON.stringify(out);
fs.writeFileSync(OUT, json + '\n');

const pathBytes = out.districts.reduce((n, d) => n + d.d.length, 0);
const report = {
  source: { file: 'data/source/bangladesh.geojson', bytes: adm3.bytes, features: adm3.json.features.length },
  joins: { byRepositoryId: assigned.length - orphans.length - applied.length, bySpatialJoin: orphans.length, byReviewedCorrection: applied.length },
  corrections: applied,
  orphanAssignments: orphans,
  output: { file: path.relative(ROOT, OUT).replace(/\\/g, '/'), bytes: Buffer.byteLength(json), districtPathBytes: pathBytes, districts: out.districts.length, viewBox: out.viewBox },
  simplification: { method: out.meta.simplification, arcVerticesBefore: arcPointsBefore, arcVerticesAfter: arcPointsAfter, sliversRemoved: slivers, subPixelRingsDropped: specksDropped, minRingAreaViewUnits: MIN_RING_AREA },
  totalAreaKm2: out.districts.reduce((n, d) => n + d.areaKm2, 0),
  warnings,
};
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');

console.log(`source   ${(adm3.bytes / 1e6).toFixed(2)} MB, ${report.source.features} ADM3 features`);
console.log(`joins    ${report.joins.byRepositoryId} by repository id, ${report.joins.bySpatialJoin} by ADM2 spatial join, ${report.joins.byReviewedCorrection} reviewed corrections`);
console.log(`simplify ${arcPointsBefore} → ${arcPointsAfter} arc vertices, ${slivers} slivers removed, ${specksDropped} sub-pixel rings dropped`);
console.log(`output   ${out.districts.length} districts, ${(report.output.bytes / 1024).toFixed(0)} KB JSON (${(pathBytes / 1024).toFixed(0)} KB path data), viewBox ${out.viewBox.join(' ')}`);
console.log(`area     ${report.totalAreaKm2.toLocaleString('en')} km² total`);
if (warnings.length) console.log(`warnings ${warnings.length}:\n  - ${warnings.join('\n  - ')}`);

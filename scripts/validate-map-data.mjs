#!/usr/bin/env node
/**
 * Validate the generated map data and the curated district content before every build.
 * Exits non-zero with a list of problems. Pure checks, no network.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

export function validate({ generated, enriched, sourceDistricts, sourceDivisions }) {
  const errors = [];
  const err = m => errors.push(m);

  // --- generated map ↔ authoritative source ids
  const expected = new Map(sourceDistricts.map(d => [d.id, d]));
  const ids = generated.districts.map(d => d.id);
  if (generated.districts.length !== 64) err(`expected 64 districts, found ${generated.districts.length}`);
  if (new Set(ids).size !== ids.length) err('duplicate district ids in generated data');
  for (const id of expected.keys()) if (!ids.includes(id)) err(`district ${id} (${expected.get(id).name}) missing from generated data`);
  for (const id of ids) if (!expected.has(id)) err(`generated district ${id} is not in bd-districts.json`);

  const divisionIds = new Set(sourceDivisions.map(d => d.id));
  const [, , W, H] = generated.viewBox;
  if (!(W > 0 && H > 0)) err('invalid viewBox');
  const codes = new Set();
  for (const d of generated.districts) {
    const src = expected.get(d.id);
    if (!src) continue;
    if (d.name !== src.name || d.bn !== src.bn_name) err(`${d.id}: name mismatch with source`);
    if (d.divisionId !== src.division_id || !divisionIds.has(d.divisionId)) err(`${d.id}: bad division join`);
    if (typeof d.d !== 'string' || !/^M[\d.\s-]+l/.test(d.d) || d.d.length < 20) err(`${d.id}: empty or malformed path`);
    const [x0, y0, x1, y1] = d.bbox;
    if (!(x0 >= 0 && y0 >= 0 && x1 <= W && y1 <= H && x1 > x0 && y1 > y0)) err(`${d.id}: bbox outside viewBox`);
    const [lx, ly] = d.label;
    if (!(lx >= x0 && lx <= x1 && ly >= y0 && ly <= y1)) err(`${d.id}: label point outside its bbox`);
    for (const n of d.neighbors) {
      const other = generated.districts.find(o => o.id === n);
      if (!other) err(`${d.id}: unknown neighbor ${n}`);
      else if (!other.neighbors.includes(d.id)) err(`${d.id}: neighbor ${n} is not symmetric`);
    }
    if (!(d.areaKm2 > 0)) err(`${d.id}: non-positive area`);
    const code = enriched[d.id]?.stamp?.code ?? d.code;
    if (!/^[A-Z]{3}$/.test(code)) err(`${d.id}: stamp code "${code}" must be three capital letters`);
    if (codes.has(code)) err(`${d.id}: stamp code ${code} is not unique`);
    codes.add(code);
  }
  for (const key of ['outline', 'divisionBorders', 'graticule']) if (!/^M/.test(generated[key] || '')) err(`missing ${key} path`);

  // --- curated content
  const STATUSES = new Set(['verified', 'mock', 'incomplete']);
  const TYPES = new Set(['food', 'culture', 'craft', 'tradition']);
  const noMarkup = (s, where) => { if (typeof s !== 'string' || !s.trim()) err(`${where}: empty text`); else if (/[<>]|javascript:/i.test(s)) err(`${where}: markup-like text is not allowed`); };
  for (const [id, entry] of Object.entries(enriched)) {
    if (id.startsWith('$')) continue;
    const src = expected.get(id);
    if (!src) { err(`enriched id ${id} is not a real district id`); continue; }
    if (entry.name?.en !== src.name || entry.name?.bn !== src.bn_name) err(`enriched ${id}: name must match source (${src.name} / ${src.bn_name})`);
    if (!STATUSES.has(entry.contentStatus)) err(`enriched ${id}: bad contentStatus ${entry.contentStatus}`);
    const items = [...(entry.landmarks || []).map(i => ['landmark', i]), ...(entry.cultureFood || []).map(i => ['cultureFood', i])];
    if (entry.contentStatus === 'verified' && !items.length) err(`enriched ${id}: verified entry has no claims`);
    items.forEach(([kind, it], i) => {
      const where = `enriched ${id} ${kind}[${i}]`;
      noMarkup(it.name?.en, `${where}.name.en`);
      noMarkup(it.name?.bn, `${where}.name.bn`);
      noMarkup(it.note, `${where}.note`);
      if (/[–—]/.test(it.note)) err(`${where}: use a hyphen, not an en/em dash`);
      if (kind === 'landmark') noMarkup(it.category, `${where}.category`);
      if (kind === 'cultureFood' && !TYPES.has(it.type)) err(`${where}: bad type ${it.type}`);
      if (!Array.isArray(it.sources) || !it.sources.length) err(`${where}: needs at least one source`);
      for (const s of it.sources || []) {
        noMarkup(s.label, `${where}.source.label`);
        let url;
        try { url = new URL(s.url); } catch { err(`${where}: invalid source url`); continue; }
        if (url.protocol !== 'https:') err(`${where}: source url must be https`);
      }
    });
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const errors = validate({
    generated: readJson('src/generated/districtPaths.generated.json'),
    enriched: readJson('src/data/districts.enriched.json'),
    sourceDistricts: readJson('data/source/bd-districts.json').districts,
    sourceDivisions: readJson('data/source/bd-divisions.json').divisions,
  });
  if (errors.length) {
    console.error(`validate-map-data: ${errors.length} problem(s)\n  - ${errors.join('\n  - ')}`);
    process.exit(1);
  }
  console.log('validate-map-data: 64 districts, content and joins OK');
}

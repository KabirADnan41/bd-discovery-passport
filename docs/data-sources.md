# Data sources and the map pipeline

## Sources (all pinned by SHA-256 in `data/source/sources.json`)

| File | Role | Origin | Licence |
|---|---|---|---|
| `bangladesh.geojson` | 544 ADM3 (upazila/thana) polygons with district joins | [ifahimreza/bangladesh-geojson](https://github.com/ifahimreza/bangladesh-geojson) @ `4723ee5`; geometry byte-identical to geoBoundaries gbOpen BGD ADM3 (commit `9469f09`) | CC BY 4.0 (geoBoundaries; authority BBS / OCHA ROAP) |
| `bd-districts.json` | **Authoritative** 64 district ids, EN/BN names, division ids | same repo | MIT |
| `bd-divisions.json` | 8 divisions, EN/BN names | same repo | MIT |
| `geoBoundaries-BGD-ADM2_simplified.geojson` | Spatial reference only (never rendered) | geoBoundaries gbOpen BGD ADM2 @ `9469f09` | CC BY 4.0 |

Attribution appears in the site footer and on `/terms/`.

## What the source actually contains (verified, not assumed)

`bangladesh.geojson` is **not** 64 district polygons. It holds 544 upazila-level polygons (492 Polygon, 52 MultiPolygon):
- **426** carry a `district_id`;
- **118 have no district at all**, including most of central Dhaka (Dhanmondi, Gulshan, Motijheel…), Chattogram city
  thanas and Cox's Bazar Sadar;
- **7 of the 426 joins are wrong.** Duplicate upazila names were matched to the wrong district upstream: Mirpur and
  Mohammadpur (Dhaka city) → Kushtia/Magura, Sreepur (Gazipur) → Magura, Daulatpur (Khulna city) → Kushtia, Companiganj
  (Noakhali) → Sylhet, and the two Pirganj polygons swapped between Rangpur and Thakurgaon.

## Pipeline (`npm run build:map`)

1. **Verify** every input's SHA-256; stop on any change.
2. **Check metadata:** exactly 8 divisions and 64 districts, unique ids, valid division joins.
3. **Map ADM2 → district ids** by name with a small alias table (Barisal→Barishal, Bogra→Bogura, Chittagong→Chattogram,
   Comilla→Cumilla, Jessore→Jashore, …). It must be one-to-one.
4. **Assign every ADM3 polygon.** A guaranteed interior point (widest scanline span) is tested against the ADM2 districts
   (planar point-in-polygon):
   - repository join and spatial result agree → keep (419 polygons);
   - no repository join → use the spatial district (118 polygons);
   - disagreement → allowed **only** if listed in the reviewed `data/source/corrections.json` (7 polygons). Any new
     disagreement, or a stale correction, fails the build.
5. **Topology:** TopoJSON with quantisation 1e5 (~5 m), so neighbours share arcs.
6. **Simplify once, on shared arcs:** Visvalingam by spherical triangle area, keeping 25% of weighted vertices
   (52,829 → 16,532). Checked visually at 1× and 2.4× on the coast and islands.
7. **Dissolve** each district with `topojson.merge`. Interior rings under 1 km² are slivers (1 removed); any real hole
   would be kept and reported (none found).
8. **Rewind** rings for d3 (exterior clockwise), then check each district's spherical area.
9. **Project:** Transverse Mercator, central meridian 90°E (the Bangladesh Transverse Mercator meridian), fitted to a
   1000-unit-wide viewBox (1000 × 1316).
10. **Serialise compactly:** absolute `M` + relative `l` deltas at 0.1-unit precision; rings under 1 square unit
    (~0.3 km², sub-pixel) dropped (121 specks).
11. **Extras:** country outline and division-border meshes, 1° graticule and labels, context labels (India, Myanmar,
    Bay of Bengal, each checked to fall outside Bangladesh), label points, bounding boxes, **neighbours from shared arcs**,
    approximate areas, and unique 3-letter stamp codes.

## Result

| Metric | Value |
|---|---|
| Source | 3.60 MB, 544 features |
| Output | 64 districts, 139 KB JSON (81 KB of path data) |
| Total area | 140,145 km² (simplified land boundaries; official figures include rivers and differ) |
| Warnings | 0 |
| Spot checks | Dhaka 1,479 km² (official ≈ 1,464); Sylhet 3,425 km² (≈ 3,452); Bhola keeps 69 island parts |

Full numbers: `data/map-build-report.json`.

## Validation (`npm run validate:data`, before every build)

64 ids exactly matching `bd-districts.json`; names and divisions match the source; valid paths; bounding boxes inside
the viewBox; label points inside their bounding box; symmetric neighbours; unique stamp codes; every curated claim has
https sources, no markup and no en/em dashes; `contentStatus` in `verified | mock | incomplete`.

## Curated content (`src/data/districts.enriched.json`)

Eight districts are **verified**: Dhaka (1), Cox's Bazar (45), Sylhet (54), Satkhira (64), Bagerhat (55), Naogaon (20),
Kushtia (60) and Tangail (17). Sources are UNESCO pages first (the World Heritage and Intangible Cultural Heritage lists),
then Wikipedia. Banglapedia returned a bot page to every request. Notes paraphrase the source and never strengthen it; for
example, Ratargul is "a freshwater swamp forest", not "the only one". The other 56 districts show real structural facts
(division, area, neighbours) and "More discoveries coming soon." To add a district: add an entry with sources, then run
`npm run validate:data`.

## Known upstream issues worth reporting

The 118 unjoined polygons and the 7 wrong joins above could be reported to ifahimreza/bangladesh-geojson. Our reviewed
corrections are in `data/source/corrections.json`.

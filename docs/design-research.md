# Design research

**Honest note on timing.** The brief asked for this research before the design was finalised. It was done afterwards, as a
check against a design already built from the `design-taste-frontend` and `high-end-visual-design` skills. It led to one
change (16 px reading text on the passport page). Nothing here was copied: no code, illustrations or brand identity.

## Local references (`D:\skills\design-md\`, VoltAgent/awesome-design-md, MIT)

### Airbnb (`design-md/airbnb/DESIGN.md`)
- **Pattern studied:** a travel-discovery product with one accent colour used sparingly, modest heading weights, and a single
  "loud" moment reserved for the strongest trust signal (the rating display).
- **Why useful:** the closest product category (exploring places).
- **Principle adopted:** one accent (passport vermilion) used only for the stamp, the selection outline and destructive actions.
  The stamp is the one loud moment.
- **How we differ:** Airbnb is photography-led on pure white. We have no photography (we can't verify stock images of real
  places, and the CSP allows only self-hosted images), so the map carries the visual weight on parchment.

### Wired (`design-md/wired/DESIGN.md`)
- **Pattern studied:** an editorial product that "refuses to dress itself as a SaaS marketing site"; hairline dividers instead
  of shadows; a masthead band as the only decoration.
- **Why useful:** the brief asks for editorial, not dashboard.
- **Principle adopted:** hairline rules to group content (the passport sections, the gazetteer), a quiet masthead, no cards
  for structure.
- **How we differ:** Wired uses serif display type and square buttons. We use one Bengali-first family (Anek Bangla) because
  Bangla readability comes first, and pill controls on 12 px surfaces as our single shape system.

### Apple (`design-md/apple/DESIGN.md`)
- **Pattern studied:** "Body copy at 17px, not 16px ... reading, not scanning"; headline weight 600 with slight negative tracking.
- **Why useful:** the passport page is reading content.
- **Principle adopted:** passport notes raised from 15.2 px to 16 px; headings at weight 600 with -0.01em tracking.
- **How we differ:** no alternating light and dark tiles; the page keeps one theme at a time (a user choice).

### The Verge (`design-md/theverge/DESIGN.md`)
- **Pattern studied:** a loud editorial colour system.
- **Why useful:** as a counter-example.
- **Principle adopted:** none directly. It confirmed that the atlas should stay calm so the map dominates.

## External references

| URL | Pattern studied | Why useful | Principle adopted | How we differ |
|---|---|---|---|---|
| https://tympanus.net/codrops/2026/05/21/creating-scroll-driven-svg-map-animations-with-gsap/ | Scroll-driven SVG map with camera moves | Shows an SVG map without a map API | Confirms plain SVG is enough for a small country | We rejected scroll hijacking: the brief and `design-taste-frontend` ban it, and it hurts keyboard users |
| https://css-tricks.com/svg-map-rollovers/ | Region hover linked to region names | Simple, dependency-free hover | Hover highlight drawn as an overlay above the fills | Our overlay keeps shared borders intact (no scaling), and the tooltip is anchored to the district, not the cursor |
| https://developer.apple.com/design/human-interface-guidelines/sheets and https://m3.material.io/components/bottom-sheets/guidelines | Sheets: grabber, swipe down to dismiss, a close button, underlying content still visible | The mobile passport page is a sheet | Grabber + velocity-based swipe dismissal + a Close button + Escape; the page scrolls so the district stays visible above the sheet | Both pages render only with JavaScript, so their text could not be fetched for quoting; we relied on these well-established platform conventions |

## What makes this design ours

A parchment atlas with a real graticule and neighbouring-country labels, hatched "uncharted" districts that turn to solid ink
when discovered, a passport booklet (green cover, brass hairline, paper page) that becomes a bottom sheet on phones, and an
inked rubber stamp with its own slight tilt for every district. None of this comes from the references above.

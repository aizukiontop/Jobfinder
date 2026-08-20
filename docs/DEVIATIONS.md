# Implementation Deviations from Manuscript

## Deviation #1 — Distance Score Normalization

**Manuscript formula (p.25):**
```
DistanceScore = 1 / (1 + shortestpath(user_location, job_location))
```

**Issue:** The manuscript does not specify the unit of `shortestpath`. Using kilometres without scaling collapses every distance past 3 km toward ≈0.06–0.21, making the geographic term non-discriminative across a 63 km² city.

**Note in manuscript (p.25):** "the distance score is scaled to a 0-1 range for each job" — scaling was already anticipated.

**Implementation refinement:**
```
NormalizedDistance = shortestPathKm / MAX_REFERENCE_DISTANCE_KM
DistanceScore      = 1 / (1 + NormalizedDistance)
```

The reciprocal form `1/(1+·)` is preserved exactly. Only the unit/scaling is specified.

**MAX_REFERENCE_DISTANCE_KM = 14.9434 km** — computed as the exact Dijkstra maximum over all 33×32 Angeles City barangay-centroid pairs (Cutud → Sapangbato). Reproducible via `scripts/computeMaxReferenceDistance.mjs`.

**Effective range of DistanceScore:** [0.5, 1.0] — distance contributes between β×0.5=0.15 and β×1.0=0.30 to MatchScore.

**Required manuscript amendment:** Add sentence specifying kilometres as the unit and the normalization divisor.

---

## Deviation #2 — α/β Notation Consistency

**Manuscript p.18:** Uses `R(a,j)=αS(a,j)+(1−α)G(a,j)` notation.  
**Manuscript p.27:** Uses `MatchScore = α × SkillMatchScore + β × DistanceScore` where `α + β = 1`.

**Implementation uses:** `α/β` notation consistently, with `ALPHA=0.7, BETA=0.3`.

**Required manuscript amendment:** Unify to α/β throughout.

---

## Deviation #3 — Prototype Job Dataset (RESOLVED)

The original prototype sample jobs have been replaced entirely by 31 verified real job postings
sourced from PhilJobNet, company websites, and PESO Angeles City. See Deviation #4 for full details.
All production jobs carry `dataSource: 'external-verified'`.

---

## Deviation #4 — Real Job Dataset Integration (August 2026)

### Source
36 records from manually collected spreadsheet (`Job_Postings-all-36-exact-locations-with-coor.xlsx`).
Sources: PhilJobNet, company websites, PESO Angeles City.

### Accepted: 31 jobs
### Rejected: 5 jobs (outside Angeles City study scope)

| Row | Company | Title | Rejection Reason |
|---|---|---|---|
| R06 | HC Consumer Finance | Sales Associate | "Pampanga Areas" — no Angeles City confirmation |
| R07 | HC Consumer Finance | Field Officer/Collector | "Pampanga Areas" — no Angeles City confirmation |
| R08 | HC Consumer Finance | Roving Sales Associate | Explicitly Mexico, Pampanga |
| R33 | Crackerjack Recruitment | Sewer | Clark Freeport Zone |
| R34 | XBP Global | Data Entry Operators | Clark Freeport Zone (Philexcel) |

### Location / Coordinate Decisions

| Company | Coordinate Source | Method |
|---|---|---|
| Encore Leasing (Santo Cristo) | `barangay-centroid` | Address explicitly states Brgy. Santo Cristo; place_id not resolvable in build env |
| KFC via TOPSPOT (Pulung Cacutud) | `barangay-centroid` | Barangay confirmed by spreadsheet |
| S&R / Primesearch (Cutcut) | `barangay-centroid` | Barangay confirmed; pre-opening, no exact pin available |
| Dalisay (Pandan) | `exact-address` | Exact coordinates 15.1484, 120.6013 from spreadsheet Google Maps pin; verified inside Angeles City boundary |
| Baker's Percent (Pulung Cacutud) | `barangay-centroid` | EPZA/Angeles Livelihood Complex confirmed within Angeles City (not Clark Freeport); place_id not resolvable |
| Edna's Cakeland | `city-centroid` | Multiple Angeles branches; specific branch not identified in posting |
| Alfamart (PESO Angeles) | `city-centroid` | Pooled multi-branch recruitment; specific branch not specified |

**EPZA / Angeles Livelihood Complex note:** This industrial complex (barangay Pulung Cacutud) is within Angeles City's administrative boundaries, distinct from Clark Freeport Zone. Accepted.

### Unresolved Skills (not in current 6-tree ontology)

These skills were extracted from postings but cannot be mapped to any existing ontology node. They contribute 0 to SkillMatchScore for those slots.

**Manufacturing / Mechanical / Trades domain (Baker's Percent):**
Hydraulics · Pneumatics · Welding (TIG/ARC) · Gearboxes · PLC Troubleshooting · 3-Phase Motors · Diesel Engine Maintenance · GMP (Good Manufacturing Practice) · HACCP · 5S · WMS (Warehouse Management System)

**Culinary / Beverage domain (Edna's Cakeland):**
Barista Skills · Latte Art · Coffee Knowledge · Food Safety Knowledge

These skills belong to a Manufacturing/Trades/Culinary domain not covered by the current 6 ontology trees. Adding them requires a manuscript amendment to expand the ontology scope. They are documented here pending researcher approval. Jobs with unresolved skills will still route correctly via Dijkstra and display in the UI; their SkillMatchScore will reflect only the mappable skills.

### Salary note
Encore Leasing salary figures (₱158,000–₱522,800) appear to be annual commission-based totals, not monthly salaries. The strings are preserved exactly as listed in the source.

### Openings note
For records where openings were not specified in the spreadsheet, a value of 1 was used (minimum viable for a job that is actively hiring). This affects Encore (all 3), KFC, all S&R roles, and all Dalisay roles.

### Prototype data
Old prototype/sample jobs removed from production dataset. Preserved in `src/data/jobs.prototype.backup.ts` for rollback only.

---

## Deviation #5 — Dijkstra Integration into MatchScore (RESOLVED — August 2026)

**Previous state (v6 and earlier):**
The `calculateMatchScore()` function in `context.tsx` used haversine straight-line distance
to compute G(a,j) rather than Dijkstra shortest-path distance. Dijkstra ran only in
`MapView.tsx` for visual route display. This contradicted the manuscript's core method section.

**Resolution (v7):**
`calculateMatchScore()` now calls `computeDijkstraDistanceScore()`, which:
1. Lazy-loads the OSM road graph (cached after first load)
2. Snaps user and job coordinates to the nearest graph nodes
3. Runs Dijkstra's Algorithm between those nodes
4. Applies `computeDistanceScore(totalKm)` = 1/(1 + totalKm/14.9434)

The function is now async (returns `Promise<number>`). All callers (`Search.tsx`, `JobDetail.tsx`,
`JobCard.tsx`, `Home.tsx`) updated to use `useState`/`useEffect` for score display.

**Search ranking fix (v7):**
`Search.tsx` now sorts the filtered job list by descending MatchScore after all Dijkstra scores
are computed. This is the thesis core output: ranked job recommendations.

**No manuscript amendment required** — the manuscript correctly describes Dijkstra-based scoring.
The prototype was the defect; the manuscript was correct.

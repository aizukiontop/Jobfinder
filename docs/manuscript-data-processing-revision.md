# Replacement text — Chapter 3, "4. Data Processing (Server vs Client)"

Replaces the paragraph beginning "JobFinder is implemented as a client-side single-page application…"

---

JobFinder is implemented as a single-page web application supported by a lightweight application server, and processing is deliberately divided between the two.

All recommendation computation is performed on the client. Ontology-based skill similarity, Haversine coordinate-to-node snapping, Dijkstra's Algorithm, distance-score normalization, composite scoring, and the final ranking of recommended jobs are executed in the job seeker's browser. The skill ontology and the geographic road-network graph are delivered to the browser as static assets and cached for the session, so recommendation scoring requires no request to the server. This keeps the algorithms under study directly observable and reproducible on the client and allows scoring to proceed without additional network round trips.

The server is responsible for persistence and delivery. A Node.js application using an embedded SQLite database stores job listings, user accounts, job-seeker and employer profiles, declared skills, saved jobs, submitted applications, and uploaded résumé files. The browser retrieves job data from this server over HTTPS rather than from files bundled with the application, so every user of the system sees the same job catalogue. Authentication uses server-issued session cookies, and passwords are stored only as scrypt-derived hashes. Résumé files are written outside the public web directory and are retrievable only by the applicant who uploaded them and by the employer who owns the corresponding job posting.

One computation is performed on the server by design. When an application is submitted, the server records an exact-match skill-overlap score between the applicant's declared skills and the job's required skills, together with a copy of both skill lists as they stood at that moment. This value is stored as an immutable snapshot so that an employer's view of an applicant does not change if the job posting or the applicant's profile is edited afterwards. It is separate from, and not a substitute for, the ontology-based SkillMatchScore computed on the client for recommendations.

This division replaces the browser-local storage used in earlier development builds. Persisting profiles, applications, and résumés in the browser's local storage confined each account to a single device and prevented employers from receiving applications submitted by job seekers, which the evaluation procedures in this study require.

---

## Why each sentence is defensible

| Claim | Where it lives in the code |
|---|---|
| Ontology similarity, snapping, Dijkstra, normalization, composite scoring, ranking all client-side | `src/context.tsx`, `src/lib/skillMatch.ts`, `src/lib/dijkstra.ts`, `src/lib/roadGraph.ts`, `src/config/matching.ts`, `src/config/geo.ts` |
| Ontology and road graph delivered as static assets | `src/data/skillOntology.ts`, `public/data/` road graph JSON |
| Job data fetched over HTTPS | `src/lib/api.ts` → `GET /api/jobs` |
| SQLite persistence of the listed entities | `server/schema.sql` |
| Session cookies, scrypt hashing | `server/security.js` |
| Résumés outside the web root, access-controlled | `server/app.js` resume routes; Nginx denies `/uploads` |
| Immutable exact-match snapshot at application time | `server/app.js` `scoreSkills()`, stored with `matching_version = 'exact-snapshot-v1'` |

## Anticipated panel questions

**"You said the algorithms are client-side but you have a server — which is it?"**
Both, and the split is the point. The server never ranks jobs; it stores and serves. Every scoring formula in Chapter 3 runs in the browser and can be inspected there.

**"Why is there a second, different skill score on the server?"**
It is not a recommendation score. It is a record of what the applicant's skills were against what the job required at the instant they applied, so employers see a stable value. The ontology score is what drives recommendations.

**"Why did you move away from local storage?"**
Because the study evaluates employers receiving applications from job seekers. With browser-local storage those are two separate browsers that can never see each other's data, so that evaluation could not be conducted.

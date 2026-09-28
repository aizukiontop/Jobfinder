# JobFinder local release verification - 2026-09-29

## Release boundary

The approved delivery is the reviewed website source in `D:\JobFinder_Final` and a local Git commit with Gab as the sole author and committer. No Git push or production deployment is authorized for this release. The manuscript is unchanged.

The updated source was prepared in the separate `panel-20260927/project` working copy. Before copying, compare the final checkout against the saved baseline. Copy only changed/new project files, preserve the pre-existing map and semantic-search work, and leave `Letter_of_Explanation_Late_Submission.docx` untracked and unchanged. Do not copy dependencies, databases, uploads, credentials, temporary work, or manuscript files.

Completed copy verification: all 94 baseline files still matched the final checkout before copying. Sixty changed/new files were copied and SHA-256 verified. A pre-copy snapshot of replaced files was kept in the ignored working evidence folder. The unrelated letter was hash-checked unchanged. The complete automated, algorithm and browser verification below was then rerun successfully from `D:\JobFinder_Final`, not just the staging copy.

## Executed local checks

- `npm test`: 48 passing tests, comprising 21 unit and 27 API tests.
- `npm run typecheck`: passed.
- `npm run verify:algorithms`: 10,609/10,609 ontology pairs and 36/36 directed route cases agree with independent same-graph references. This does not measure external relevance or real-world route accuracy.
- `JOBFINDER_BASE=/ npm run build`: passed. Existing non-blocking Vite warnings concern configuration compatibility, an ineffective dynamic import and a large frontend chunk.
- `node scripts/browser-release-check.mjs`: seven checks passed against the built frontend and real local API using a disposable SQLite database and fictional accounts. External browser requests were blocked and real email was disabled.
- Browser coverage: rapid weight edits and reload persistence; forced save failure and retry; weights shared by Search/Profile; error clearing on navigation and browser Back; PESO login and approval; mobile admin-postings layout and exact preservation of all 36 seeded legacy job rows.
- The prior minor error-banner carryover is fixed in `src/context.tsx`.

The corresponding command outputs are saved in `docs/verification/local-automated-2026-09-29.txt` and `docs/verification/local-browser-2026-09-29.txt`. These are implementation checks, not new questionnaire results, expert relevance/accuracy labels or proof of live deployment. The Word test reports and bug log remain historical September 27 snapshots; the current Markdown notes record later verification.

## Why deployment is held

Read-only replica inspection found approximately 77.6 MiB in the existing JobFinder API service and 11.2 MiB in its Nginx service, about 89 MiB combined. These measurements describe the OLD deployed version, not a measured production footprint for this candidate. The user explicitly retained the earlier approximately 80 MB budget and instructed: commit locally and hold deployment.

The VPS had approximately 135 MiB available RAM and 1.8 GB free root-disk space (96% used). MySQL and JobFinder services were active; the replica check reported healthy replication with zero-second lag. No server files, services, limits, live data, domains or protected IGST components were changed. No backup, restore or migration was attempted on the live database in this release.

## Gates for a future deployment

1. Resolve the resource constraint within the approved budget and recheck memory, disk, listeners, MySQL and replica health. Do not raise limits or touch IGST without authorization.
2. Report exact planned JobFinder files/services/configuration, expected footprint and rollback procedure before changes. Use only the authorized replica VPS.
3. Create a consistent JobFinder SQLite backup, verify a restore and rehearse the one-time users-table migration. Preserve all existing users, applications, files, posting content and legacy visibility. Never reseed over live rows.
4. Build locally; deploy only isolated JobFinder artifacts. Keep the API on its existing loopback-only port and leave protected MySQL/replication/SSH/backup infrastructure unchanged.
5. Correct the JobFinder application origin to the main HTTPS domain as a separately verified configuration change. It was still configured to the older sslip.io origin at inspection.
6. The user will create the PESO administrator themselves after deployment using `npm run admin:create -- <email> "PESO Angeles City"` in the deployed application with the correct database environment. Do not run this against an unintended local/default database. Do not send passwords in chat.
7. Keep `JOBFINDER_MAIL_PROVIDER=none` and `JOBFINDER_NOTIFICATIONS_ENABLED=0` until a verified sender and approval for real sending exist. Mock acceptance is not proof of inbox delivery.
8. Recheck public/API health, service memory, legacy data, MySQL and zero/near-zero replica lag after an eventual approved release.

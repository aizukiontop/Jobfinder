# Post-defense website change log

Status: local release candidate verified on 2026-09-29. Deployment is explicitly ON HOLD under the user's 80 MB budget. See `LOCAL_RELEASE_2026-09-29.md` for current checks and remaining release gates; the September 27 Word reports are historical snapshots.

## User-approved scope

- Admin approval and management for FUTURE job postings. Existing postings keep their content, status and visibility and are exempt from review.
- Each account can adjust the skill/distance percentages; 70/30 stays the default.
- Email notifications implemented and tested with a fake mailer. Real sending stays OFF (no verified sender yet).
- Documented test cases, this development change log, and an admin-only change log (audit trail) inside the website.
- The ontology-aware search and the map tile fix from 2026-09-17 are kept.

## Changes

| Area | Before | After | Files |
| --- | --- | --- | --- |
| Posting approval | Employers published directly. | New and edited employer postings are "pending" until an admin approves them. Admins can approve, reject, suspend or archive with a reason (reason optional only for approve). A version number stops an admin approving content that changed after they opened it. Public lists, job pages, saving and applying only accept postings that are "existing" or "approved". | server/app.js, server/panel.js, server/db.js, server/schema.sql |
| Existing postings | - | The migration only adds columns. Every existing row is marked "legacy" and is left untouched. The job import no longer overwrites existing rows, so it can't undo admin decisions or edits made on the server. | server/db.js |
| Admin rights | Any account whose email was in JOBFINDER_ADMIN_EMAILS was an admin, including accounts registered later. | The admin is LGU PESO Angeles City, a separate account type ("admin" role). The users table is rebuilt once to allow the new role, and every existing row is copied unchanged. PESO accounts cannot sign up; they are created on the server with `npm run admin:create -- <email> "PESO Angeles City"`. JOBFINDER_ADMIN_EMAILS is no longer used. | server/db.js, server/schema.sql, server/panel.js, server/cli/create-admin.js, .env.example |
| Weights | Fixed 70/30. | Each account saves a whole-number skill percentage from 0 to 100 (distance = 100 minus skill). It is set in Profile > Recommendation Settings or on the Search page. Job detail shows how many points each part adds. A missing distance counts as 0; the weights are never re-scaled to make up for it. At 100% skill no route is calculated. Employer applicant scores are not affected. | src/config/matching.ts, src/context.tsx, src/components/WeightSlider.tsx, src/pages/Profile.tsx, src/pages/Search.tsx, src/pages/JobDetail.tsx |
| Outdated scores | Home, Search, job cards and job detail could show a result computed with the old weight or location. | Each score calculation is cancelled when its inputs change. | src/pages/Home.tsx, src/pages/Search.tsx, src/components/JobCard.tsx, src/pages/JobDetail.tsx |
| Job detail hooks | Hooks ran after early returns, which breaks when a job loads late. | The score hook now runs before the early returns. | src/pages/JobDetail.tsx |
| Email | Password reset email only. | A SQLite email queue inside the existing API process sends notices about posting decisions, new applications and application status changes. It retries up to 3 times and uses a stable key per event so the same email is never queued twice. Users can opt out. Provider errors are not stored. When sending is off (JOBFINDER_NOTIFICATIONS_ENABLED=0, the default), events are recorded as "not sent". | server/notifications.js, server/mailer.js, server/config.js, server/index.js |
| Change log in the website | None. | Admin-only, append-only audit_events table. It records admin decisions, submissions, posting edits, profile and preference changes, application submissions and status changes, and admin grants. Entries hold field names only, never values, passwords, tokens or resumes. | server/panel.js, server/app.js |
| PESO admin area | Account list only. | PESO signs in to its own area with its own header, like the employer area. Dashboard: review, job, employer, job seeker and application counts, new submissions, recent activity. Job Postings: filter, preview and decide. Employers: details, counts, each employer's postings, suspend (reason required) and reactivate. A suspended employer is signed out, cannot sign in, and their postings are hidden; applications are kept. Job Seekers: view-only list. Activity Logs: change log and email log. | src/components/AdminHeader.tsx, src/pages/admin/*.tsx, src/components/AdminPostings.tsx, src/components/AdminActivityLog.tsx, src/lib/panelAdminApi.ts, src/lib/access.ts, src/lib/router.ts, src/App.tsx, server/panel.js |
| Employer pages | Status showed draft, active or closed. | Status shows Draft, Pending review, Approved, Rejected (with reason), Suspended, or Existing posting. The submit button reads "Submit for Review", and the confirmation screen describes what actually happened. Employers can turn email notices on or off. | src/pages/employer/*.tsx, src/components/PostingReviewStatus.tsx, src/components/NotificationToggle.tsx |
| Dijkstra guard | A missing start or end node returned a 0 km route marked as found. | It now returns "not found". | src/lib/dijkstra.ts |
| Error banner after navigation | A failed page action could leave its error message on the next page. | In-app navigation and browser Back/Forward clear the previous action error. Both paths are covered by the local browser release check. | src/context.tsx, scripts/browser-release-check.mjs |

## Current verification (2026-09-29)

- 48 automated tests pass: 21 unit and 27 API tests. Type checking and the root-path production build pass.
- Seven local browser checks pass, including previously unexecuted PREF-06 and PREF-10, shared saved weights, both navigation-error regressions, PESO approval and 375 px layout. All 36 seeded legacy postings are unchanged in the disposable test database.
- The minor error-banner issue left open in the Word bug log is fixed and retested by this release. The Word file is retained as the earlier snapshot, not rewritten to imply its tests were run again.
- No live database migration, service restart, domain change, administrator creation, email sending, Git push or deployment is part of this local release.

## Test evidence (2026-09-27)

- 20/20 unit tests: algorithms, search and weights (`node --test tests/*.test.mjs`).
- 22/22 server tests: the 8 existing ones plus 14 new moderation/preferences/audit/email tests (`node --test --test-concurrency=1 server/test/*.test.js`). One existing test now approves the job before applying.
- Algorithm check: 10,609/10,609 skill pairs and 36/36 road routes agree with independent calculations.
- Type check and production build (JOBFINDER_BASE=/) pass.
- Browser check on a throwaway local database with test accounts: submit for review, pending status, reject without a reason blocked, approve, public listing, change log, email log ("not sent"), saving the weight slider by keyboard, and the same 89% score on job detail and search. No sideways scrolling at 375 px.
- Test cases: docs/JobFinder_Test_Cases_By_User.docx (93 cases across job seeker, employer, PESO admin and system: 90 Pass, 0 Fail, 3 Not executed).
- Bug fix log: docs/JobFinder_Bug_Fix_Log.docx (15 bugs: 14 fixed, 1 minor open). The three first-run failures were fixed and retested: search reach limited to two links (src/lib/jobSearch.ts), drafts can be edited and finished (src/pages/employer/EmployerJobs.tsx, EmployerPostJob.tsx), and a clear lockout message (server/app.js). Latest evidence: evidence/test-run-2026-09-27-peso.txt (46 automated tests pass, typecheck and build pass).

## Historical pending items and current disposition

- PREF-06 (fast weight changes) and PREF-10 (forced save failure): subsequently passed on 2026-09-29; see current verification above.
- Real email delivery: needs a verified sender and your approval to turn sending on.
- Deployment: held by the user after read-only checks found the currently running API and Nginx together use about 89 MiB. The 80 MB budget remains unchanged. A future release still needs a fresh resource check, database backup and restore test, migration rehearsal and the app-origin fix, with the proposed changes reported first.
- Copying into D:\JobFinder_Final and committing locally are authorized. Compare against the baseline and preserve unrelated uncommitted files; do not push or deploy as part of that operation.

## Limits

This is post-defense work. It does not change the original questionnaire results. The algorithm checks confirm the calculations are done correctly; they do not measure recommendation accuracy, which still needs expert-labelled test cases.

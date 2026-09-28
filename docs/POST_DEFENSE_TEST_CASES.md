# JobFinder post-defense website test cases

The test cases, with steps, data, expected results and actual results, are in
`JobFinder_Test_Cases_By_User.docx` in this folder, grouped into Job Seeker, Employer, PESO Admin and System checks.
It replaces the earlier `JobFinder_Post_Defense_Test_Cases.docx`, which covered only the new features.

The Word files contain the earlier September 27 manual test reports. They are retained as historical evidence; their counts must not be combined with automated test totals. The first run failed JS-09, JS-16 and EM-07; the fixes and retests are in `JobFinder_Bug_Fix_Log.docx`.

Current verification (2026-09-29): 48 automated tests (21 unit, 27 API) and seven isolated browser release checks pass. Type checking and the production build also pass. See `LOCAL_RELEASE_2026-09-29.md` and the text evidence under `verification/`. Real email delivery and live deployment are NOT verified by these local checks.

## Additional browser cases executed on 2026-09-29

| Case | Action | Expected and observed result |
| --- | --- | --- |
| PREF-06 | Quickly move the skill slider through several values, finish at 85 and save; reload. | No change is persisted before Save; 85/15 is saved and restored on reload. Pass. |
| PREF-10 | Fail the preference PATCH with HTTP 503; then retry successfully. | Existing 85/15 remains saved; the UI shows the error and old applied weights, then saves 80/20 on retry. Pass. |
| Shared preference | Navigate from Search to Profile after saving 80/20. | Profile displays 80/20. Pass. |
| Error navigation | Force a saved-job failure, then use an in-app navigation button. | The failure is visible on the originating page and cleared on the next page. Pass. |
| Error history | Force another saved-job failure, then use browser Back. | The old action error is cleared. Pass. |
| PESO approval | Log in as a fictional PESO account; review and approve a pending fictional posting. | The posting becomes approved and publicly visible only after the decision. Pass. |
| Layout and preservation | Check the admin postings page at 375 px; compare all seeded legacy job rows. | No page-wide horizontal overflow; all 36 legacy rows unchanged; no browser exceptions; notification delivery disabled. Pass. |

Reproduce with a root-path build and `node scripts/browser-release-check.mjs`. Playwright must be available; `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` can point to an existing installation. The script binds only to an ephemeral loopback port, blocks external browser requests, uses fictional accounts and deletes only its own temporary test directory. It never opens the live database.

## How the tests were run

- On a throwaway local SQLite database with fictional accounts, never against the live server.
- Real email sending was off. Sending tests used a fake mailer inside the test.
- Commands, run from the project folder:
  - `node --test tests/*.test.mjs`: algorithm, search and weight tests
  - `node --test --test-concurrency=1 server/test/*.test.js`: server tests
  - `node scripts/verify-algorithms.mjs`: writes docs/verification/algorithm-verification.json
  - `node node_modules/typescript/bin/tsc --noEmit`
  - Production build for the VPS: set `JOBFINDER_BASE=/`, then `npx vite build`. Never use the GitHub Pages deploy command for the VPS.
- Browser checks used a local API and Vite on 127.0.0.1 with test accounts.

## Interpreting results

"Pass" means the actual result matched the expected result, including negative cases where the system correctly refused something. The algorithm checks confirm the calculations are correct; they are not a measure of recommendation accuracy, map completeness or travel time, and they do not replace the original questionnaire evaluation.

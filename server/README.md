# JobFinder API

This is the isolated Express and SQLite backend for JobFinder. It is designed to run as one
loopback-only Node process behind its own Nginx site, with its own Linux user, database and
upload directory.

## Local setup

1. Copy `.env.example` values into your shell or a private environment file.
2. Run `npm run db:migrate`.
3. Run `npm run db:seed` to insert the verified jobs as external-application-only records.
4. Run `npm run start:api`.
5. Verify `GET http://127.0.0.1:3210/api/health`.

The API does not seed accounts or demo passwords. Browser integration uses same-origin `/api`
requests, so `JOBFINDER_APP_ORIGIN` must match the site origin exactly. For local development use
the Vite proxy; do not weaken the cookie or origin checks to reach the API from another origin.

Uploads are private files under `JOBFINDER_UPLOAD_DIR`. Express never mounts this directory as
static content. Only the applicant and the employer that owns the job may download an application
resume.

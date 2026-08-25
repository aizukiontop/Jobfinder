# JobFinder API

This is the isolated Express and SQLite backend for JobFinder. It is designed to run as one
loopback-only Node process behind a separate Nginx site. It does not use the IGSTPREM MySQL
database or any protected replica service.

## Local setup

1. Copy `.env.example` values into your shell or a private environment file.
2. Run `npm run db:migrate`.
3. Run `npm run db:seed` to insert the 31 verified jobs as external-application-only records.
4. Run `npm run start:api`.
5. Verify `GET http://127.0.0.1:3210/api/health`.

The API does not seed accounts or demo passwords. Browser integration should use same-origin
`/api` requests after the final domain and HTTPS are configured. Until then, use a local Vite
proxy; do not weaken cookie or origin checks to connect GitHub Pages to a bare IP address.

Uploads are private files under `JOBFINDER_UPLOAD_DIR`. Express never mounts this directory as
static content. Only the applicant and the employer that owns the job may download an application
resume.

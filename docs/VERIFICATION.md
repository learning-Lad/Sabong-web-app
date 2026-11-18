# Web-only verification record

## Poultry tracker revision

- Type checks, production build, 15 database/domain/API checks, and nine Chromium
  flows passed locally.
- The PostgreSQL fixture installed the flock migration over an existing farm,
  preserved old bird values, allowed blank strain entries, and rejected linking a
  bird to a flock owned by another farm.
- The browser suite verified mixed and legacy breed values, flock creation and
  renaming, reload persistence, shared dashboard and directory filtering, and
  continued care, photo, and recovery flows. Browser cloud requests were mocked.
- Production checks still require running the new migration in the live Supabase
  project and checking the Vercel deployment.

## Original web delivery

Checked November 18, 2026. Upstream baseline remains `27a5d76` in
`nimrodcaraca-rgb/Sabong`; the user's uploaded package/README/Vite configuration
matches that original demo. This delivery is a standalone web project, not a patch.

| Check | Result |
| --- | --- |
| Original stylesheet comparison with GitHub | Exact original stylesheet retained, with small connected-feature additions |
| `npm run check` | Zero errors and zero Svelte warnings; frontend, Vite config, server and API TypeScript checked |
| `npm test` | 14 passing PostgreSQL/domain/API tests |
| `npm run build` without cloud settings | Passed; temporary demo remains available |
| Configured production build | Passed with test-only Supabase settings |
| Private AI key isolation | Test marker absent from all client build assets |
| Administrative key in a public setting | Build correctly rejects it before serving the app |
| Browser suite | Eight passing flows, including photo upload/reload and actual local API HTTP handling |
| Interactive `npm run setup` | Created the expected ignored local configuration in a temporary test folder |
| Setup/backup script syntax | Passed |
| Workflow YAML / Vercel JSON / lockfile identity | Parsed and checked |

The eight browser flows cover:

1. Bird creation, reload persistence, profile edits, pen assignment/unassignment and validation.
2. Care logs, stock deductions, reminder completion, CSV export and independent AI failure.
3. Registration and recovery requests with honest confirmation messages.
4. Separation of real-account records from temporary demo records on sign-out.
5. Narrow-screen navigation, entry dialogs and report access without page overflow.
6. Recovery-link completion, new password submission and return to sign-in.
7. Photo upload, persisted photo path, reload, authenticated download and Blob URL display.
8. Real HTTP method/authentication errors from the shared local API bridge.

The database tests execute the SQL migration in PGlite with fixture Supabase Auth
and Storage schemas. They cover farm/private-photo isolation, parent/pairing
integrity, atomic care deductions and retries, stock interleaving, stale versions,
AI request limits, and expired/revoked sessions. The API tests mock external Auth,
database REST and model requests, including a forged farm identifier and provider failure.
Browser cloud requests are mocked. The local HTTP bridge itself is exercised over HTTP.

Not verified using real services: your Supabase project, SMTP delivery, an actual
Gemini/Ollama response, a live Vercel deployment, cloud backup execution/restore,
real camera hardware, latest two Safari/Edge versions, LTE timings, 85% health
precision or 99.5% uptime. A separate ORM is not introduced. These are documented
acceptance boundaries rather than successful live checks.

No remote GitHub repository, database, website, or existing mobile app was modified.
Use START_HERE.md and DEPLOYMENT_GUIDE.md to configure and deploy your own copy.

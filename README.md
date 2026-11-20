# Sabong web app

Svelte 5 + TypeScript + Vite, with the existing dark red/gold UI. This standalone
project contains the web app, its Supabase SQL migration, and a Vercel AI endpoint.
It does not contain or require the mobile app.

```bash
npm ci
npm run dev
```

Open the URL printed by Vite and choose **Explore the UI demo** to try the interface.
For real accounts and saved records, start with [START_HERE.md](START_HERE.md), then
follow [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md). After creating your Supabase project
and running the migration, `npm run setup` creates your local connection settings.

## Connected features

- Email/password accounts, email-link recovery, farm isolation and idle-session expiry.
- Bird records with known, custom, mixed, and unknown breeds, optional strain, private photos, pens, and computed ages.
- Named flocks within a single farm account, with flock filters on the dashboard bird list and directory.
- Lineage bookkeeping, pairing/hatch records and explicitly linked offspring.
- Bird/pen care logs, reminders, supply usage, atomic stock deductions and version checks.
- Printable individual bird care history and farm reports with date filters and CSV exports.
- Daily flock checklist, editable egg totals by date, and a seven-day egg summary.
- In-app notification count for low-stock items and open care reminders.
- Optional consent-based Gemini/Ollama welfare observations; manual records work if AI fails.

The app excludes cockfighting scheduling, brackets, fighting statistics and fighting
predictions. Health-model precision, end-to-end LTE timing, hosted uptime, cloud
backup recovery and the literal ORM criterion are not certified. Read the
[SRS audit](docs/SRS_AUDIT.md) before treating this as full SRS compliance.

## Verification

```bash
npm run verify
npx playwright install chromium
npm run test:e2e
```

PostgreSQL tests use PGlite with fixture Supabase Auth/Storage schemas. Browser tests
mock cloud endpoints; API tests mock external providers. Actual Supabase, SMTP,
Vercel and AI-provider setup must be checked using your own project after deployment.

## Deployment shape

Vercel serves `dist/` and the root `api/farm-assistant.ts` function. Supabase provides
Auth, PostgreSQL and private Storage. No service-role key is required by the normal
runtime. The Gemini key is private and used only by the server function. The local
Vite server bridges the same API handler for `npm run dev`.

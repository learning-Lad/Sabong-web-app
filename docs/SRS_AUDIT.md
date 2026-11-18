# Web app baseline and SRS coverage

Source baseline: `nimrodcaraca-rgb/Sabong`, `master` commit `27a5d76`.
Requirements: supplied `SRS_Group11.pdf`, version 1.00 (10 pages).
Scope: web app. Mobile code is unchanged. Web-only packaging review: November 18, 2026.

## Current poultry tracker revision

The target users are independent chicken keepers and small poultry farms. Each
account manages one farm and may create multiple named flocks. A bird can belong
to one flock independently of its housing pen. The dashboard bird list and
directory can filter by flock. Dashboard totals, reminders, and inventory are
farm-wide.

Bird registration supports a starter list, custom breed labels, mixed or
crossbred birds, and unknown ancestry. Strain or bloodline is optional, and
parent links represent recorded ancestry. The upgrade preserves existing
breed and strain values and leaves existing birds unassigned to a flock.
The bird profile and bird report show flock membership.

Use this section to update the original SRS with the group. The requirements
for farm care, housing, lineage, and record security remain relevant. Replace
event and match requirements in the revised SRS with flock creation, naming,
bird assignment, and filtering. The historical coverage table below records
the original comparison.

## What already worked

The original `web-app/README.md` described an in-memory UI demo, which source
inspection confirmed. The unchanged baseline passed `npm run check` with zero
errors/warnings and `npm run build`. A browser check of the immutable baseline confirmed six sample birds, seven after a new entry, and six again after refresh. The original stylesheet, red/gold visual
language, navigation layout, card components and form patterns were retained.

| Original area | Baseline behavior | Treatment |
| --- | --- | --- |
| Dashboard, roster and search/status filters | Derived views of sample records | Retained the views; connected permitted records to cloud data |
| Bird registration/editing, photos and pen selection | Updated browser memory only | Retained forms; added cloud persistence, private photo upload and stronger validation |
| Age display | Computed from hatch date | Retained calculation; date keys and server date checks now use Asia/Manila |
| Lineage and pairing entry | In-memory parents/grandparents and hatch counts | Extended ancestry navigation, explicit pairing-to-offspring link and hatch-result updates |
| Health, reminders and supplies | In-memory logs, task completion and one-unit adjustments | Connected existing actions; added arbitrary stock amounts and atomic care deductions |
| Reports | Printable sample tables; hard-coded farm name | Retained printing; added actual farm name, date ranges and safe CSV export |
| Authentication/recovery | Accepted sample input; did not authenticate or send mail | Replaced with Supabase Auth requests, recovery completion and session handling |
| Persistence and tenant isolation | No database connection | Added PostgreSQL migration, Auth ownership, RLS and private Storage rules |
| Match/bracket screens and fighting records | Existing demo-only screens | Not implemented, connected, or enhanced; inaccessible from this farm-records app |
| AI | No AI backend | Added optional, consent-based welfare observations service with honest failure state |

## Requirement mapping

“Implemented” below means code and local checks exist. It does not claim that an
unconfigured cloud project, SMTP sender or model has been exercised end-to-end.

| SRS requirement | Result and evidence |
| --- | --- |
| 3.1.1.1 registration | Supabase email/password sign-up with farm metadata; server trigger creates owner-bound farm |
| 3.1.1.2 login/logout | Actual Auth sign-in; logout revokes app session and clears browser records |
| 3.1.1.3 password recovery | Email-link request, recovery mode and new-password submission; SMTP configuration still required |
| 3.1.2.1 bird registration | Breed/bloodline/sex/color/date/photo, random unique ID enforced by database key |
| 3.1.2.2 profile/status updates | Weight, traits, status, name, notes and photo updates; optimistic version guards |
| 3.1.2.3 pens | Create, assign, transfer, unassign; same-farm composite foreign keys |
| 3.1.2.4 dynamic age | Existing months/years calculation retained |
| 3.1.3.1 pairing records | Available male/female selection, date and parent validation; neutral lineage bookkeeping only |
| 3.1.3.2 offspring | Egg/hatch counts, editable hatch results, explicit breedingId on each linked chick |
| 3.1.3.3 pedigree | Recursive tree through five ancestor levels; selecting an ancestor continues exploration; invalid/cyclic links rejected |
| 3.1.4.1 care | Bird or pen care logs with type/date/notes and optional transactional supply usage |
| 3.1.4.2 reminders | Due/overdue dashboard count, calendar, pending list and completion; dashboard alerts only, no email/push promise |
| 3.1.4.3 inventory | Persistent supplies, fractional stock changes, insufficient-stock rejection and movement records |
| 3.1.5 match/events | Outside supported scope; no match database or connected match actions |
| 3.1.6 roster | Photos, pen, bloodline and age; fighting win/loss records excluded |
| 3.1.7 profiles | Names, photo uploads and pedigree notes |
| 3.1.8 summaries | Birthdate/age/breeder/pedigree; fighting statistics excluded |
| 3.1.9 reports | Bird, health, breeding and supply print/CSV reports with farm name; fighting event reports excluded |
| 3.1.10.1 inference <3s | Vercel API with a bounded provider deadline (12s default, up to 15s) and browser timeout; the 3s end-to-end target remains unmet/unverified |
| 3.1.10.2 health precision >=85% | Not established: no evaluated health model/dataset. Critical health alerts are disabled; no accuracy claim |
| 3.1.10.3 privacy | Auth/RLS isolation, private photos, explicit per-request AI consent, minimal profile fields, no stored AI output |
| 3.1.10.4 degradation | AI route fails independently; manual bird/care/pen/roster/supply actions remain usable |
| 3.2 mobile/errors/navigation | Existing responsive layout; highlighted validation and focus; main add/care actions remain within three clicks |
| 3.3.1 uptime | Infrastructure/monitoring requirement; not guaranteed by local code or a free plan |
| 3.3.2 daily backups | Encrypted scheduled database + private-object export job; needs secrets, a first successful run and a restore rehearsal |
| 3.4 performance/concurrency | Atomic database operations, per-record version checks and paged reads; 4G timings/load targets remain unmeasured |
| 3.5.1 farm isolation | RLS checks active owner-bound farm on each table; composite same-farm foreign keys and Storage policies |
| 3.5.2 passwords/HTTPS | Managed Supabase Auth; no plaintext application password storage; production must use provider HTTPS origins |
| 3.5.3 idle timeout | Browser activity timer plus database-enforced 60-minute session inactivity/revocation; token refresh does not renew app activity |
| 3.6.1 browser compatibility | Chromium desktop and narrow-screen viewport tested locally; latest two Safari/Edge versions still need device testing |
| 3.6.2 relational database | PostgreSQL with real relational foreign keys, checks, transactions, indexes and policies |
| 3.7.1 interface | Existing sidebar, mobile bottom navigation, dashboard cards and entry dialogs retained |
| 3.7.2 ORM | Uses a mapped Supabase/PostgREST repository and SQL constraints, **not a separate ORM**. A literal ORM criterion remains an architectural gap |
| 3.7.3 camera | Separate file chooser and camera-capture input; HTTPS/device permission and real-device behavior require acceptance testing |

## Verification

- Baseline and updated type checks / builds.
- Embedded PostgreSQL migration tests use real SQL with fixture Auth/Storage schemas:
  two-farm read/write isolation, private paths, parent/pairing checks, stock/care
  rollback, interleaved stock changes, stale update rejection, request limits and
  expired/revoked session rejection.
- Domain tests cover invalid dates/weights, lineage cycles, CSV formula safety,
  AI consent and image bytes, provider errors, missing configuration and aborts.
- Browser tests use a **mocked Supabase API**, covering persistent reload behavior,
  actual frontend Auth calls, forms, care deductions, reminders, reports, AI failure,
  sample/account separation and mobile navigation. They do not test real delivery,
  hosted RLS, cloud migrations, hardware camera permissions or model accuracy.

See [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) for the remaining operator setup and acceptance checks.

Exact local outcomes are recorded in [VERIFICATION.md](VERIFICATION.md).


## Standalone web delivery

The new package has `package.json`, `src`, `public`, `api`, `server`, `config`,
`supabase`, tests and documentation at one project root. It contains no mobile app
and requires no patch. The original GitHub branch is still at the baseline commit;
no source changes were pushed to it. The uploaded package/README/Vite files also
match that original demo configuration.

AI now uses a private Vercel Node.js endpoint, shared with local development through
Vite. Only Supabase public settings and the optional server-side AI key are needed
for the normal runtime. The original stylesheet was compared with GitHub and remains
an exact prefix of the current stylesheet; the small additions support the connected
features. No frontend framework or visual redesign was introduced.

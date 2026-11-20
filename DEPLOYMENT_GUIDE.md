# Deploy from scratch: VS Code → your GitHub → Vercel + Supabase

This guide is for the standalone **Sabong_Web_App** folder in this ZIP. Run commands
inside that folder, which contains `package.json`. The commands work in the VS Code
terminal; Windows users can use PowerShell. The app is already implemented. The
remaining work here connects it to accounts and services **you own**.

## 1. Install the prerequisites and run the demo

1. Install **Node.js 24 LTS**: https://nodejs.org/en/download. Install **Git** if you
   want to push from your terminal: https://git-scm.com/downloads.
2. Extract the ZIP. In VS Code choose **File → Open Folder → Sabong_Web_App**.
3. Open **Terminal → New Terminal** and check:

   ```bash
   node -v
   npm -v
   ```

   Node should print `v24...`. If Windows does not recognize the command after
   installation, close and reopen VS Code.
4. Install the dependencies and start:

   ```bash
   npm ci
   npm run dev
   ```

5. Open http://localhost:5173 (or the URL Vite prints). Select **Explore the UI demo**.
   Sample changes reset when you leave the demo; they are never uploaded into real farms.
6. Stop the local server with **Ctrl+C** before changing configuration.

You do not need the uploaded `node-runtime.zip`, a mobile folder, Docker, a separate
Express server, or a Supabase CLI installation for the main deployment steps.

## Upgrade an existing deployment

1. Keep your current Supabase project and Vercel environment variables.
2. Back up the existing database. In Supabase **Table Editor**, check the
   `public` schema for `app_flocks`. If it is missing, run the full contents
   of `supabase/migrations/202611180002_poultry_flocks.sql` in a new SQL Editor
   query. This is the earlier flock migration.
3. Run `supabase/migrations/202611200003_flock_care_and_eggs.sql` in a separate new
   SQL Editor query. Run each migration once. Verify Table Editor shows
   `app_flock_tasks`, `app_flock_checks`, and `app_egg_collections`.
4. Deploy the updated source to the existing Vercel project after the migrations
   succeed. If it deploys from GitHub, merge or push to the production branch.
5. Open the production URL and sign in. Check an existing bird profile, then
   create a flock task, mark it done and save an egg count. Reload to verify both
   records. Check the low-stock bell count and print one bird's care history.

## 2. Create your Supabase project and database

1. Open https://supabase.com/dashboard and sign in.
2. Create a new project. Choose your organization, enter a project name, generate a
   database password and select a suitable region. Keep the database password privately;
   it is **not** the publishable key and is not needed in the web app.
3. Wait for project provisioning to finish.
4. In VS Code open:

   ```text
   supabase/migrations/202611170001_farm_records.sql
   ```

5. Copy that file's complete contents. In Supabase open **SQL Editor → New query**,
   paste it, and click **Run**. Run it **once** as one complete transaction.
6. Open a second new query, then run the full contents of
   `supabase/migrations/202611180002_poultry_flocks.sql`. Apply migrations in
   filename order and run each once.
7. In a third new query, run `supabase/migrations/202611200003_flock_care_and_eggs.sql`.
8. Check that Table Editor contains `app_farms`, `app_birds`, `app_pens`, `app_flocks`,
   `app_breeding`, `app_health`, `app_reminders`, `app_supplies`,
   `app_supply_movements`, `app_sessions`, `app_ai_requests`, `app_flock_tasks`,
   `app_flock_checks` and `app_egg_collections`.
9. Under **Storage**, verify the `farm-bird-photos` bucket exists and is **private**.
   The migration creates the bucket and its access policies; do not make it public.

For a current farm-records database, use the upgrade steps above.

The database creates each user's farm automatically and checks farm ownership on
queries. Signed-out users cannot read farm records. Parent, pen and offspring links
cannot point into another farm. The server also enforces the 60-minute idle session.

## 3. Find the Supabase URL and the correct key

In your Supabase project:

1. Open the project's **Connect** dialog. Copy the **Project URL** and **publishable
   key** shown there. You can also find keys under **Settings → API Keys**.
2. The URL resembles `https://your-project-reference.supabase.co`.
3. The recommended public key begins `sb_publishable_`. A legacy `anon` key is also
   supported. Never use a `sb_secret_` or legacy `service_role` key in a `VITE_` setting.

In your VS Code terminal, run:

```bash
npm run setup
```

Paste the project URL when asked, then the publishable key. The command creates an
ignored `.env.local` file. It rejects an administrative key in the public setting.

Your file will contain these names (the values below are examples to replace):

```dotenv
VITE_SUPABASE_URL=https://your-project-reference.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_actual_public_key
GEMINI_API_KEY=
AI_MODEL=gemini-3.5-flash-lite
```

The two `VITE_` values are public by design. Access control comes from Auth and the
SQL policies, not from hiding the publishable key. The private AI value has no
`VITE_` prefix. Do not upload `.env.local` to GitHub.

## 4. Configure sign-up, confirmation and password recovery

1. In Supabase **Authentication**, ensure the email/password provider is enabled.
2. Under **URL Configuration**, initially set **Site URL** to
   `http://localhost:5173` and add these redirect patterns:

   ```text
   http://localhost:5173/**
   http://127.0.0.1:5173/**
   ```

3. Set the minimum password length to at least eight characters.
4. Configure **custom SMTP** using an email delivery provider and a verified sender
   (for example, a provider such as Resend or Brevo). In that provider's dashboard,
   obtain its SMTP host, port, username, password and sender address; enter them in
   Supabase's SMTP settings. Follow the provider's sender/domain-verification steps.
5. Supabase's default email sender is restricted. Do not assume it will deliver
   sign-up/recovery emails to arbitrary users. For a real application configure SMTP
   and keep email confirmation enabled.
6. Start the local app:

   ```bash
   npm run dev
   ```

7. Select **Create an account**, enter your farm name, email and password, and follow
   the confirmation email. Sign in with that account. It starts with empty farm data.
8. Register a bird, refresh the page, and confirm it is still present. Sign in from
   another browser to confirm it is saved remotely.
9. Test **Forgot password**, open the actual email link, save a new password and
   sign in again. An on-screen email request confirmation is not proof of delivery.

For an isolated classroom/local test only, you can temporarily disable email
confirmation or create a confirmed test user in Supabase Auth. That does not enable
password-reset email delivery; SMTP still needs its own verification before production.

## 5. Create and configure the AI API key

The AI feature is optional. Core records, photos, care and inventory work without it.

1. Open https://aistudio.google.com/api-keys and sign in with your Google account.
2. Create an API key for your own Google project. Check the project's API access and
   quota/billing settings; free-tier access is subject to Google's model and quota rules.
3. Use `gemini-3.5-flash-lite` as the initial model. The official model page lists
   text/image inputs and text output, and its pricing page currently lists a free tier.
4. Open your local `.env.local`, fill in `GEMINI_API_KEY=YOUR_ACTUAL_KEY`, and save.
   Keep `AI_MODEL=gemini-3.5-flash-lite` unless selecting another compatible model.
5. Stop and restart `npm run dev` after editing the file.
6. Sign into a real farm account, open **Care assistant**, enter observations,
   optionally choose a photo, review the data-sharing consent and submit.

The local API and Vercel function keep the AI key server-side. Do **not** create a
`VITE_GEMINI_API_KEY` variable. You do not need to deploy a Supabase Edge Function.
No Auth/service-role admin key is required for this endpoint: it verifies the signed-in
user, checks their active farm session and uses their own database access rules.

Gemini's unpaid service can use submitted content to improve Google's products and
may involve human review. The UI requires explicit consent and sends only the user's
observations, optional photo, and breed/sex/color/hatch date for a selected bird. It
saves no AI output to the database. Do not put confidential or personal information
in observations or photos.

AI observations are unverified, not a diagnosis or critical alert. The app caps AI
requests at ten per farm per hour. The default provider timeout is 12 seconds
(configurable up to 15); the browser allows additional request time. This prioritizes
returning a usable response when possible, and **does not establish the SRS's
three-second end-to-end target or 85% health precision**. Failures leave manual
records available.

## 6. Push the project to your own GitHub repository

1. On GitHub create a new empty repository under your own account, for example
   `sabong-web`. Choose its visibility. Leave README, `.gitignore` and license
   initialization unchecked so the remote begins empty.
2. In the VS Code terminal at the **Sabong_Web_App** folder, run:

   ```bash
   git init
   git add .
   git commit -m "Initial web app with Supabase and AI"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```

3. Replace the URL with your new repository's URL. Complete GitHub's sign-in when
   prompted. If Git asks for your author name/email, configure your own identity
   using `git config user.name "Your Name"` and `git config user.email "your@email.com"`,
   then repeat the commit/push.
4. On GitHub confirm the repository root shows `package.json`, `src`, `public`,
   `api`, `server`, `supabase`, `vercel.json` and `.gitignore`.
5. Confirm `.env.local`, `node_modules` and `dist` are absent. They are ignored.

If you are copying into an existing repository instead, retain its `.git` folder and
review changes before committing. Do not create another nested repository by mistake.
No files need to be copied to, or changed in, a mobile application.

## 7. Deploy to Vercel

1. Open https://vercel.com/new and sign in.
2. Import the GitHub repository you just created. Grant access to that repository
   if Vercel cannot see it.
3. Check the build settings:

   | Setting | Exact value |
   | --- | --- |
   | Framework Preset | **Vite** |
   | Root Directory | **`./`** — the directory containing `package.json` |
   | Node.js version | **24** |
   | Install Command | **`npm ci`** |
   | Build Command | **`npm run build`** |
   | Output Directory | **`dist`** |

4. Add these environment variables. Use your real values, not the examples:

   | Variable name | Value / source | Needed for |
   | --- | --- | --- |
   | `VITE_SUPABASE_URL` | Supabase project URL from Connect | Real accounts, records, photos |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key or legacy anon key | Real accounts, records, photos |
   | `GEMINI_API_KEY` | Your Google AI Studio API key | Optional AI, server only |
   | `AI_MODEL` | `gemini-3.5-flash-lite` | Optional AI; also the default |

5. Apply them to **Production** and the other environments you intend to use.
   Mark the private AI key sensitive if Vercel offers that option. Never add a
   service-role or database password under a `VITE_` name.
6. Click **Deploy** and wait for success. Open the resulting HTTPS website.
7. Vercel serves the frontend and detects the root `api/farm-assistant.ts` function.
   No extra Express service, Docker image, or separate AI deployment is needed.

The included configuration adds basic security/camera headers and permits the usual
`*.supabase.co` API domain. If using a custom Supabase host, add that exact host to
the `connect-src` policy in `vercel.json` before building. Navigation is in-page;
no SPA wildcard rewrite should send `/api/farm-assistant` to `index.html`.

## 8. Connect your final Vercel address back to Supabase

Suppose Vercel gives you `https://your-project.vercel.app`:

1. Return to Supabase **Authentication → URL Configuration**.
2. Change **Site URL** to `https://your-project.vercel.app`.
3. Add `https://your-project.vercel.app/**` to the redirect allowlist. Keep the local
   entries if you still develop locally. Add the exact origin of any staging or
   custom domain you actually use; do not broadly allow unrelated domains.
4. Test a new sign-up and the received confirmation link on the deployed site.
5. Test password recovery and ensure its email returns to the deployed site.
6. Sign in and test create/edit/refresh, photo upload, pen assignment, reminders,
   supply deductions and report export. Try the optional AI endpoint separately.
7. Create a second farm account and confirm it cannot see the first account's data.

Changing Vercel environment variables requires a **new deployment**. In Vercel's
Deployments tab choose the latest deployment and **Redeploy**, or push a new commit.
Public Vite values are embedded during the build; an old deployment keeps its old values.

## 9. Optional daily backups

The app includes `.github/workflows/daily-backup.yml`. It schedules an encrypted
export of the database and private photo objects for **02:00 Asia/Manila**. GitHub
schedules can be delayed; this needs monitoring and a real restore rehearsal.

This is optional for starting the UI, but needed to work toward the SRS backup target:

1. Install `age` on a trusted machine and run `age-keygen -o farm-backup-identity.txt`.
   Store the private identity safely **outside GitHub**. Keep its public `age1…` recipient.
2. In your repository's **Settings → Secrets and variables → Actions**, add:

   | Secret | Value |
   | --- | --- |
   | `SUPABASE_DB_URL` | Database connection string from Supabase Connect (direct or session pooler, not transaction mode) |
   | `SUPABASE_URL` | Your Supabase HTTPS project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin/legacy service-role key, used only by the backup job |
   | `BACKUP_AGE_RECIPIENT` | Your public age recipient |

3. Match the workflow's `postgres:17` image to your project's PostgreSQL major version.
4. Under Actions **Variables**, create `ENABLE_FARM_BACKUPS` with value `true` after
   configuring the secrets. Without this explicit enable setting the backup job is
   skipped, so a fresh repository does not run an unconfigured backup.
5. After pushing the workflow to your repository's default branch, open Actions and
   run **Encrypted daily farm backup** manually once.
6. Confirm success, download its encrypted artifact, and rehearse recovery in a
   separate staging project. Only the encrypted archive is uploaded; retention is seven days.
7. Decrypt on a trusted machine using your private age identity, inspect the database
   dump with `pg_restore --list`, then use Supabase's documented restoration process
   for managed Auth/Storage schemas. Restore photos into the private bucket with the
   same object paths. Compare data and image downloads before considering recovery verified.

These four backup secrets do **not** belong in the browser or normal Vercel runtime.
Supabase Free does not include the paid plans' managed daily-backup service and may
pause low-activity projects. A free setup alone cannot establish a 99.5% uptime promise.

## 10. Common errors

| Symptom | What to check |
| --- | --- |
| `node` or `npm` not recognized | Install Node.js 24 and reopen VS Code |
| Cannot find `package.json` | Open the extracted project folder, not its parent or only `src` |
| Cloud accounts are not configured | Run `npm run setup`, then restart Vite; in Vercel add both public variables and redeploy |
| Invalid configuration / secret key rejected | Use the project URL and publishable key from Supabase Connect, not a database URL or service-role key |
| Missing relation/table/function | Run the complete migration once in the intended Supabase project |
| Confirmation/recovery email does not arrive | Check SMTP/sender verification, recipient restrictions, rate limits and spam folder |
| Email link opens localhost after deploying | Update Supabase Site URL and allowed redirects, then request a new email |
| Invalid login credentials | Verify the actual email/password and confirmation status; the demo creates no real account |
| Photo upload fails | Verify the private bucket/policies; choose JPG, PNG or WebP at most 5 MB; verify you are signed in |
| Another-device edit rejected | Use Refresh records before editing again; stale changes are blocked intentionally |
| AI is not configured | Add the server-only `GEMINI_API_KEY` locally or in Vercel and restart/redeploy |
| AI model/quota error | Verify the model and key project in AI Studio; check free quota, region eligibility and the ten-request app limit |
| AI works in dev but not static preview | Use `npm run dev` or Vercel. `npm run preview` serves static assets only |
| AI response is HTML / API 404 | Check the root `api` folder was pushed, Node.js 24 is selected and no wildcard rewrite hides `/api` |
| Vercel deployment fails | Check build logs and the root directory; run `npm run verify` locally |
| Session expires | Sign in again. Browser activity and server-side session expiry apply; refresh-token rotation does not renew idle activity |

## Acceptance boundaries

Local tests cover the code and SQL with test fixtures, not your live credentials.
Cloud email delivery, a real AI response, hosted policies, real camera permission,
Safari/Edge versions, LTE latency, backup recovery and uptime must be verified after
setup. AI health precision is not validated; automated critical health alerts stay
disabled. The implementation uses a Supabase/PostgREST repository and relational SQL,
not a separate ORM. Fighting-related features are outside this web package's scope.

## Official references (checked November 18, 2026)

- Supabase keys: https://supabase.com/docs/guides/getting-started/api-keys
- Auth/redirects: https://supabase.com/docs/guides/auth/redirect-urls
- SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Private Storage: https://supabase.com/docs/guides/storage/security/access-control
- Backups: https://supabase.com/docs/guides/platform/backups
- Vite on Vercel: https://vercel.com/docs/frameworks/frontend/vite
- Node.js functions: https://vercel.com/docs/functions/runtimes/node-js
- Gemini keys: https://aistudio.google.com/api-keys
- Model: https://aistudio.google.com/docs/models/gemini-3.5-flash-lite
- Pricing: https://ai.google.dev/gemini-api/docs/pricing
- Data-use terms: https://ai.google.dev/gemini-api/terms

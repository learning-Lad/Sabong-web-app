# Start here: Sabong web app

This is the complete web app, ready to open as one folder. It preserves the original
red/gold interface. No patch application, mobile app, bundled Node runtime, or Express
server is needed. You supply your own cloud credentials; no real account keys are included.

## 1. Run the interface first

1. Install **Node.js 24 LTS** from https://nodejs.org/en/download.
2. Extract the ZIP and open **Sabong_Web_App** in VS Code.
3. Select **Terminal → New Terminal**. Confirm the folder contains `package.json`.
4. Run these commands, one at a time:

   ```bash
   npm ci
   npm run dev
   ```

5. Open the local URL printed by Vite, normally http://localhost:5173.
6. Click **Explore the UI demo**. This uses temporary sample records; it proves the
   interface runs without requiring an account. Stop the server with **Ctrl+C**.

## 2. Enable real accounts and saved records

Follow **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**, sections 1–4:

1. Create your Supabase project.
2. Run the three SQL migrations in filename order, once each, for a new project. For an existing project, use the deployment guide's upgrade steps.
3. Copy your project URL and **publishable** key from Supabase.
4. In the VS Code terminal run:

   ```bash
   npm run setup
   npm run dev
   ```

5. Create a real farm account on the sign-up screen. Configure email delivery as
   described in the guide if you want confirmation and password recovery emails.

The setup command writes `.env.local` on your machine. That file is ignored by Git.

## 3. Add optional AI

Create your own Gemini API key in https://aistudio.google.com/api-keys.
Open `.env.local` and fill the blank `GEMINI_API_KEY=` value. Restart `npm run dev`.
The key is read by the local API, not shipped to the browser. The same API runs on
Vercel after deployment. No Supabase Edge Function deployment is required.

The default model is `gemini-3.5-flash-lite`. Its free-tier quota and availability
are controlled by Google. AI supports unverified welfare observations and optional
photos; it does not diagnose disease or create critical health alerts.

## 4. Push to your repository, then deploy

Follow the guide's GitHub and Vercel sections. Push this folder's **contents** so
GitHub shows `package.json` at the repository root. In Vercel use:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Root directory | `./` (the folder containing `package.json`) |
| Node.js | 24 |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |

Add the environment variables from the guide, deploy, then update Supabase Auth's
Site URL and redirect allowlist to your final HTTPS domain.

## Files you will use

| File or folder | Purpose |
| --- | --- |
| `src/`, `public/` | Existing web screens, styling, and assets with connected features |
| `supabase/migrations/` | Farm database, flock and optional-strain upgrade, and flock care and egg tables |
| `.env.example` | Names of the public and private configuration values |
| `api/farm-assistant.ts`, `server/` | Server-side AI endpoint for Vercel and local development |
| `DEPLOYMENT_GUIDE.md` | Complete instructions, key locations, email, troubleshooting, backups |
| `docs/SRS_AUDIT.md` | What worked originally, what was added, and remaining SRS acceptance gaps |
| `docs/VERIFICATION.md` | Recorded verification and live-service boundaries |

Run `npm run verify` to check types, database/domain/API tests, and the production
build. `npm run preview` previews static assets only; use `npm run dev` for the local
AI endpoint, or the deployed Vercel URL for production AI.

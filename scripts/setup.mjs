import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { inspectPublicConfiguration } from '../config/public-env.ts';
const target = fileURLToPath(new URL('../.env.local', import.meta.url));
const input = createInterface({ input: stdin, output: stdout });
try {
  console.log('Configure the public Supabase connection. Do not enter a secret or service-role key.');
  let exists = false; try { await access(target); exists = true; } catch {}
  if (exists && (await input.question('.env.local already exists. Replace it? [y/N] ')).trim().toLowerCase() !== 'y') {
    console.log('Existing settings kept.');
  } else {
    const url = (await input.question('Supabase project URL: ')).trim();
    const key = (await input.question('Supabase publishable key (or legacy anon key): ')).trim();
    const config = inspectPublicConfiguration(url, key);
    if (!config.configured) throw new Error(config.error || 'Both values are required.');
    await writeFile(target, `VITE_SUPABASE_URL=${config.url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${config.key}\n\n# Optional AI key: server only. Set this locally or in Vercel, never with a VITE_ prefix.\nGEMINI_API_KEY=\nAI_MODEL=gemini-3.5-flash-lite\n`, {mode:0o600});
    console.log('Saved .env.local. Run the database migration in Supabase, then npm run dev.');
  }
} catch (error) { console.error(error.message || 'Setup could not complete.'); process.exitCode = 1; }
finally { input.close(); }

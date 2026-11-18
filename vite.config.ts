import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, loadEnv } from "vite";
import { inspectPublicConfiguration } from "./config/public-env.js";
import { handleAssistantRequest } from "./server/assistant.js";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const config = inspectPublicConfiguration(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
  if (config.error) throw new Error(config.error);
  return {
    plugins: [
      svelte(),
      {
        name: "local-farm-assistant",
        configureServer(server) {
          server.middlewares.use("/api/farm-assistant", async (req, res) => {
            try {
              // Bridge the local development request to the same Fetch handler used by Vercel.
              const headers = new Headers();
              for (const [key, value] of Object.entries(req.headers)) {
                if (typeof value === "string") headers.set(key, value);
                else if (value) headers.set(key, value.join(", "));
              }
              let body: string | undefined;
              if (!["GET", "HEAD"].includes(req.method || "GET")) {
                const chunks: Buffer[] = [];
                let size = 0;
                for await (const chunk of req) {
                  size += Buffer.byteLength(chunk);
                  if (size > 2_000_000) {
                    res.statusCode = 413;
                    res.setHeader("Content-Type", "application/json");
                    res.end(
                      JSON.stringify({ error: "The image is too large." }),
                    );
                    return;
                  }
                  chunks.push(Buffer.from(chunk));
                }
                body = Buffer.concat(chunks).toString("utf8");
              }
              const result = await handleAssistantRequest(
                new Request("http://localhost/api/farm-assistant", {
                  method: req.method || "GET",
                  headers,
                  body,
                }),
                env,
              );
              res.statusCode = result.status;
              result.headers.forEach((value, key) => res.setHeader(key, value));
              res.end(await result.text());
            } catch {
              res.statusCode = 503;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error:
                    "The AI service is unavailable. Manual records remain available.",
                }),
              );
            }
          });
        },
      },
    ],
  };
});

import { createClient } from "@supabase/supabase-js";
import { inspectPublicConfiguration } from "../config/public-env.js";
import { askProvider, validateInput } from "./ai/provider.js";
export type ServerEnvironment = Record<string, string | undefined>;
const MAX_BODY_BYTES = 2_000_000;
function reply(status: number, data: object): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(status === 405 ? { Allow: "POST" } : {}),
    },
  });
}

/** Runs on Vercel and behind the local Vite middleware, never in the browser. */
export async function handleAssistantRequest(
  request: Request,
  env: ServerEnvironment,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "POST") return reply(405, { error: "Use POST." });
  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer \S+$/.test(authorization))
    return reply(401, { error: "Sign in to use the assistant." });
  if (!request.headers.get("content-type")?.includes("application/json"))
    return reply(415, { error: "Send a JSON request." });
  let body: Record<string, unknown>, input;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply(400, { error: "Enter observations." });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return reply(413, {
          error: "The image is too large. Choose a smaller photo.",
        });
      }
      chunks.push(value);
    }
    const data = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.byteLength;
    }
    body = JSON.parse(new TextDecoder().decode(data));
    input = validateInput(body);
  } catch (error) {
    return reply(400, {
      error:
        error instanceof SyntaxError
          ? "The request could not be read."
          : (error as Error).message,
    });
  }
  const settings = inspectPublicConfiguration(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
  if (!settings.configured)
    return reply(503, {
      error:
        "The cloud connection is not configured. Manual demo records are still available.",
    });
  const provider = env.AI_PROVIDER || "gemini";
  if (
    (provider === "gemini" && !env.GEMINI_API_KEY) ||
    (provider === "ollama" && (!env.OLLAMA_URL || !env.OLLAMA_TOKEN))
  ) {
    return reply(503, {
      error:
        "AI has not been configured by the farm operator. You can continue with manual care records.",
    });
  }
  const client = createClient(settings.url, settings.key, {
    global: { headers: { Authorization: authorization }, fetch: fetcher },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser(authorization.slice(7));
    if (authError || !user)
      return reply(401, { error: "Your session expired. Sign in again." });
    const { data: farmId, error: sessionError } =
      await client.rpc("app_farm_id");
    if (sessionError || !farmId)
      return reply(401, { error: "Your session expired. Sign in again." });
    let context: object = {};
    if (body.birdId) {
      if (typeof body.birdId !== "string")
        return reply(400, { error: "Choose a valid bird." });
      const { data, error } = await client
        .from("app_birds")
        .select("breed,sex,color,hatchDate")
        .eq("id", body.birdId)
        .eq("farm_id", farmId)
        .maybeSingle();
      if (error || !data)
        return reply(404, { error: "Bird not found in your farm." });
      context = data;
    }
    const { error: limitError } = await client.rpc("app_reserve_ai_request");
    if (limitError)
      return reply(429, {
        error:
          "AI request limit reached. Try again later. Manual records remain available.",
      });
    const configuredTimeout = Number(env.AI_TIMEOUT_MS || 12000);
    const timeout = Number.isFinite(configuredTimeout)
      ? Math.min(15000, Math.max(1000, configuredTimeout))
      : 12000;
    const advice = await askProvider(
      {
        provider,
        model: env.AI_MODEL || "gemini-3.5-flash-lite",
        key: env.GEMINI_API_KEY,
        url: env.OLLAMA_URL,
        token: env.OLLAMA_TOKEN,
      },
      input,
      context,
      AbortSignal.timeout(timeout),
      fetcher,
    );
    return reply(200, {
      advice,
      notice:
        "AI observations are unverified. This is not a diagnosis or a critical health alert.",
    });
  } catch {
    // Never log prompts, photos, tokens, keys, or upstream response bodies.
    return reply(503, {
      error:
        "The AI service is unavailable or did not respond in time. Continue with manual care records and try again later.",
    });
  }
}

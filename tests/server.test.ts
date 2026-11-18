import { test } from "node:test";
import assert from "node:assert/strict";
import { handleAssistantRequest } from "../server/assistant";
import { inspectPublicConfiguration } from "../config/public-env";
const env = {
  VITE_SUPABASE_URL: "https://test-project.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
  GEMINI_API_KEY: "test-server-key",
  AI_MODEL: "gemini-3.5-flash-lite",
};
const userId = "10000000-0000-4000-8000-000000000001";
function request(
  body: unknown = { observations: "Routine observations", consent: true },
  token = "test-token",
) {
  return new Request("https://example.test/api/farm-assistant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify(body),
  });
}
function mockRemote(
  options: {
    invalidUser?: boolean;
    expired?: boolean;
    missingBird?: boolean;
    limited?: boolean;
    providerDown?: boolean;
  } = {},
) {
  const calls: {
    url: string;
    headers: Headers;
    body: Record<string, unknown> | undefined;
  }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input),
      headers = new Headers(init?.headers),
      body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ url, headers, body });
    const json = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (url.includes("/auth/v1/user"))
      return options.invalidUser
        ? json({ message: "Invalid JWT" }, 401)
        : json({ id: userId, email: "test@example.invalid" });
    if (url.includes("/rpc/app_farm_id"))
      return json(options.expired ? null : "farm-A");
    if (url.includes("/app_birds"))
      return json(
        options.missingBird
          ? []
          : [
              {
                breed: "Chicken",
                sex: "Male",
                color: "White",
                hatchDate: "2025-01-01",
              },
            ],
      );
    if (url.includes("/rpc/app_reserve_ai_request"))
      return options.limited
        ? json({ message: "Limit reached" }, 400)
        : json(null);
    if (url.startsWith("https://generativelanguage.googleapis.com/"))
      return options.providerDown
        ? json({ error: "upstream detail must stay private" }, 503)
        : json({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: "Record the observations and discuss concerns with a veterinarian.",
                    },
                  ],
                },
              },
            ],
          });
    throw new Error("Unexpected remote call: " + url);
  };
  return { fetcher, calls };
}
test("public environment accepts publishable keys and rejects secret/incorrect settings", () => {
  assert.equal(inspectPublicConfiguration().configured, false);
  assert.equal(
    inspectPublicConfiguration(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
    ).configured,
    true,
  );
  assert.match(
    inspectPublicConfiguration(env.VITE_SUPABASE_URL, "sb_secret_do_not_expose")
      .error,
    /cannot be used/,
  );
  const secret = [
    "eyJhbGciOiJIUzI1NiJ9",
    Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url"),
    "signature",
  ].join(".");
  assert.equal(
    inspectPublicConfiguration(env.VITE_SUPABASE_URL, secret).configured,
    false,
  );
  assert.equal(
    inspectPublicConfiguration("not-a-url", env.VITE_SUPABASE_PUBLISHABLE_KEY)
      .configured,
    false,
  );
  assert.equal(
    inspectPublicConfiguration(
      "https://test.supabase.co/rest/v1",
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
    ).configured,
    false,
  );
});
test("AI endpoint requires method, identity, consent and bounded input before external calls", async () => {
  const remote = mockRemote();
  assert.equal(
    (
      await handleAssistantRequest(
        new Request("https://test/api"),
        env,
        remote.fetcher,
      )
    ).status,
    405,
  );
  assert.equal(
    (await handleAssistantRequest(request(undefined, ""), env, remote.fetcher))
      .status,
    401,
  );
  assert.equal(
    (
      await handleAssistantRequest(
        request({ observations: "Notes", consent: false }),
        env,
        remote.fetcher,
      )
    ).status,
    400,
  );
  const huge = new Request("https://test/api", {
    method: "POST",
    headers: {
      Authorization: "Bearer test",
      "Content-Type": "application/json",
    },
    body: "x".repeat(2_000_001),
  });
  assert.equal(
    (await handleAssistantRequest(huge, env, remote.fetcher)).status,
    413,
  );
  assert.equal(remote.calls.length, 0);
});
test("AI endpoint verifies Auth and active farm, and ignores a forged farm identifier", async () => {
  for (const option of [{ invalidUser: true }, { expired: true }]) {
    const remote = mockRemote(option);
    assert.equal(
      (await handleAssistantRequest(request(), env, remote.fetcher)).status,
      401,
    );
    assert.ok(
      !remote.calls.some((call) => call.url.includes("googleapis.com")),
    );
  }
  const remote = mockRemote();
  const result = await handleAssistantRequest(
    request({
      observations: "Routine observations",
      consent: true,
      birdId: "B1",
      farmId: "farm-B",
    }),
    env,
    remote.fetcher,
  );
  assert.equal(result.status, 200);
  assert.match((await result.json()).advice, /Record the observations/);
  const birdCall = remote.calls.find((call) =>
    call.url.includes("/app_birds"),
  )!;
  assert.equal(new URL(birdCall.url).searchParams.get("farm_id"), "eq.farm-A");
  const modelCall = remote.calls.find((call) =>
    call.url.includes("googleapis.com"),
  )!;
  assert.equal(modelCall.headers.get("x-goog-api-key"), "test-server-key");
  assert.ok(!JSON.stringify(modelCall.body).includes("test@example.invalid"));
  assert.ok(!JSON.stringify(modelCall.body).includes("farm-B"));
});
test("AI limits, missing setup and provider failures leave manual records independent", async () => {
  const missing = await handleAssistantRequest(
    request(),
    { ...env, GEMINI_API_KEY: "" },
    mockRemote().fetcher,
  );
  assert.equal(missing.status, 503);
  for (const [options, status] of [
    [{ missingBird: true }, 404],
    [{ limited: true }, 429],
    [{ providerDown: true }, 503],
  ] as const) {
    const remote = mockRemote(options);
    const response = await handleAssistantRequest(
      request({
        observations: "Routine observations",
        consent: true,
        birdId: "B1",
      }),
      env,
      remote.fetcher,
    );
    assert.equal(response.status, status);
    const body = await response.text();
    assert.ok(!body.includes("test-server-key"));
    assert.ok(!body.includes("upstream detail"));
  }
});

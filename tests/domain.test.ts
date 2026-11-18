import { test } from "node:test";
import assert from "node:assert/strict";
import { csv } from "../src/lib/csv";
import { farmDate } from "../src/lib/utils";
import { validateBird, validDate } from "../src/lib/validation";
import type { Bird } from "../src/lib/types";
import {
  askProvider,
  validateInput,
} from "../server/ai/provider";
const base: Bird = {
  id: "B1",
  name: "Bird",
  breed: "Chicken",
  bloodline: "Line",
  sex: "Male",
  color: "Red",
  hatchDate: "2025-01-01",
  weight: 1,
  status: "Active",
  penId: "",
  sireId: "",
  damId: "",
  breeder: "",
  pedigreeNotes: "",
};
test("dates, lineage cycles, weights and spreadsheet content", () => {
  assert.equal(farmDate(new Date("2026-11-17T16:30:00Z")), "2026-11-18");
  assert.equal(validDate("2025-02-30"), false);
  assert.ok(
    validateBird({ ...base, hatchDate: "2028-01-01" }, [], [], "2026-11-17")
      .hatchDate,
  );
  assert.ok(validateBird({ ...base, weight: -1 }, [], [], "2026-11-17").weight);
  const parent = { ...base, id: "P", hatchDate: "2020-01-01", sireId: "B1" };
  assert.match(
    validateBird({ ...base, sireId: "P" }, [base, parent], [], "2026-11-17")
      .sireId!,
    /cycle/,
  );
  assert.equal(
    csv([["=1+1", "a,b", '"quoted"']]),
    '"\'=1+1","a,b","""quoted"""',
  );
});
test("AI requires consent and validates uploaded bytes", () => {
  assert.throws(() => validateInput({ observations: "Notes" }), /Consent/);
  assert.throws(
    () =>
      validateInput({
        observations: "Notes",
        consent: true,
        image: { mimeType: "image/jpeg", data: btoa("not jpeg") },
      }),
    /format/,
  );
  assert.throws(
    () =>
      validateInput({
        observations: "prepare a bird for fighting",
        consent: true,
      }),
    /welfare/,
  );
  assert.deepEqual(
    validateInput({ observations: " Routine observations ", consent: true }),
    { observations: "Routine observations" },
  );
});
test("provider errors, empty results, timeout and missing configuration degrade honestly", async () => {
  const input = { observations: "Routine care notes" };
  await assert.rejects(
    askProvider({ provider: "gemini" }, input, {}, AbortSignal.timeout(100)),
    /not configured/,
  );
  const mock = async () =>
    new Response(
      JSON.stringify({
        candidates: [
          { content: { parts: [{ text: "Keep a record of observations." }] } },
        ],
      }),
      { status: 200 },
    );
  assert.equal(
    await askProvider(
      { provider: "gemini", model: "test-model", key: "test-only" },
      input,
      {},
      AbortSignal.timeout(100),
      mock,
    ),
    "Keep a record of observations.",
  );
  await assert.rejects(
    askProvider(
      { provider: "gemini", model: "test-model", key: "test-only" },
      input,
      {},
      AbortSignal.timeout(100),
      async () => new Response("{}", { status: 429 }),
    ),
    /unavailable/,
  );
  await assert.rejects(
    askProvider(
      { provider: "gemini", model: "test-model", key: "test-only" },
      input,
      {},
      AbortSignal.timeout(100),
      async () => new Response("{}", { status: 200 }),
    ),
    /No usable/,
  );
  await assert.rejects(
    askProvider(
      {
        provider: "ollama",
        model: "vision",
        url: "http://unsecured",
        token: "test",
      },
      input,
      {},
      AbortSignal.timeout(100),
    ),
    /not configured/,
  );
  await assert.rejects(
    askProvider(
      { provider: "gemini", model: "test", key: "test" },
      input,
      {},
      AbortSignal.abort(),
      async (_url, init) => {
        if (init?.signal?.aborted)
          throw new DOMException("Timed out", "AbortError");
        return new Response();
      },
    ),
    /Timed out/,
  );
});

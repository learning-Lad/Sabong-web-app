<script lang="ts">
  import { ImagePlus, Sparkles } from "@lucide/svelte";
  import { store } from "../lib/store.svelte";
  import { cloud, readableError } from "../lib/supabase";
  let birdId = $state(""),
    observations = $state(""),
    consent = $state(false),
    busy = $state(false),
    error = $state(""),
    answer = $state("");
  let image = $state<{ mimeType: string; data: string } | undefined>(undefined),
    fileName = $state("");
  async function choosePhoto(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    image = undefined;
    fileName = "";
    error = "";
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      error = "Choose a JPG, PNG, or WebP photo up to 5 MB.";
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height)),
        canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      image = {
        mimeType: "image/jpeg",
        data: canvas.toDataURL("image/jpeg", 0.75).split(",")[1]!,
      };
      fileName = file.name;
    } catch {
      error = "This photo could not be read. Choose another image.";
    }
  }
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = "";
    answer = "";
    if (!observations.trim()) {
      error = "Describe the observations you want to review.";
      return;
    }
    if (!consent) {
      error = "Review and accept the data-sharing consent first.";
      return;
    }
    if (store.demo) {
      error =
        "AI is available after signing in to a configured farm account. Manual demo records remain available.";
      return;
    }
    busy = true;
    try {
      const { data: sessionData } = await cloud().auth.getSession();
      if (!sessionData.session)
        throw new Error("Sign in to use the assistant.");
      const response = await fetch("/api/farm-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + sessionData.session.access_token,
        },
        body: JSON.stringify({
          birdId: birdId || undefined,
          observations,
          consent,
          image,
        }),
        signal: AbortSignal.timeout(22000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data?.error ||
            "The AI service is unavailable. Manual records remain available.",
        );
      if (data?.error) throw new Error(data.error);
      if (typeof data?.advice !== "string")
        throw new Error(
          "The AI service returned an incomplete response. Try again later.",
        );
      answer = data.advice;
      consent = false;
    } catch (e) {
      error = readableError(e);
    } finally {
      busy = false;
    }
  }
</script>

<div class="page-stack">
  <div class="page-heading">
    <div>
      <p class="kicker">Optional AI</p>
      <h1>Care assistant</h1>
      <p class="page-lead">
        Organize observations and questions for your veterinarian.
      </p>
    </div>
  </div>
  <div class="workspace-notice">
    Image observations are unverified and cannot establish a bird’s health.
    Automated critical health alerts are disabled until a suitable model is
    independently evaluated. Care logs, reminders, and inventory work without
    AI.
  </div>
  <section class="panel">
    <form class="assistant-form" onsubmit={submit}>
      <label class="field"
        ><span>Bird (optional)</span><select bind:value={birdId}
          ><option value="">General observation</option
          >{#each store.birds as bird}<option value={bird.id}
              >{bird.name}</option
            >{/each}</select
        ><small class="field-hint"
          >Only breed, sex, color, and hatch date are shared from the selected
          profile.</small
        ></label
      >
      <label class="field"
        ><span>Your observations</span><textarea
          bind:value={observations}
          maxlength="2000"
          required
          placeholder="Describe visible changes, routine care observations, or records you want to organize."
        ></textarea></label
      >
      <label class="field"
        ><span><ImagePlus size={16} /> Optional photo</span><input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onchange={choosePhoto}
        /><small class="field-hint"
          >{fileName ||
            "Photo is sent only when you choose Review observations."}</small
        ></label
      >
      {#if image}<button
          class="text-button"
          type="button"
          onclick={() => {
            image = undefined;
            fileName = "";
          }}>Remove selected photo</button
        >{/if}
      <label class="consent-label"
        ><input type="checkbox" bind:checked={consent} /><span
          >I consent to sending these observations, the optional photo, and the
          selected profile details to this farm’s configured AI provider. If the
          operator uses Gemini’s unpaid service, Google may use this content to
          improve its products and human reviewers may see it. I have removed
          confidential or personal information. Results are not saved to the
          farm database.</span
        ></label
      >
      {#if error}<p class="form-error" role="alert">{error}</p>{/if}
      <button class="primary-button" type="submit" disabled={busy}
        >{#if busy}Reviewing…{:else}<Sparkles size={18} /> Review observations{/if}</button
      >
    </form>
  </section>
  {#if answer}<section class="panel" role="status">
      <h2>Unverified observations</h2>
      <p class="ai-result">{answer}</p>
      <p class="muted-note">
        This is not a diagnosis or a critical health alert. Seek veterinary
        review for health concerns.
      </p>
    </section>{/if}
</div>

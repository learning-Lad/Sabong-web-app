<script lang="ts">
  import {
    ArrowRight,
    Bird,
    LockKeyhole,
    Mail,
    ShieldCheck,
  } from "@lucide/svelte";
  import { auth } from "../lib/auth.svelte";
  import { cloudConfigured, readableError } from "../lib/supabase";
  let { onEnter }: { onEnter: () => void } = $props();
  let mode = $state<"login" | "register" | "recover" | "reset">("login");
  let email = $state(""),
    password = $state(""),
    farm = $state(""),
    error = $state(""),
    message = $state(""),
    busy = $state(false);
  let errors = $state<Record<string, string>>({});
  $effect(() => {
    if (auth.recovering) mode = "reset";
  });
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = "";
    message = "";
    auth.notice = "";
    errors = {};
    if (mode !== "reset" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errors.email = "Enter a valid email address.";
    if (mode !== "recover" && password.length < (mode === "login" ? 6 : 8))
      errors.password =
        "Use at least " + (mode === "login" ? 6 : 8) + " characters.";
    if (mode === "register" && !farm.trim())
      errors.farm = "Enter your farm name.";
    if (Object.keys(errors).length) return;
    busy = true;
    try {
      if (mode === "login") await auth.signIn(email.trim(), password);
      else if (mode === "register") {
        const active = await auth.register(email.trim(), password, farm.trim());
        if (!active) {
          message = "Check your email to confirm your account, then sign in.";
          password = "";
        }
      } else if (mode === "recover") {
        await auth.recover(email.trim());
        message =
          "If an account exists for that address, a recovery link will arrive by email.";
      } else {
        await auth.updatePassword(password);
        mode = "login";
        password = "";
      }
    } catch (e) {
      error = readableError(e);
    } finally {
      busy = false;
    }
  }
  function switchMode(next: typeof mode) {
    mode = next;
    error = "";
    message = "";
    errors = {};
    auth.notice = "";
    password = "";
  }
</script>

<div class="auth-layout">
  <div class="auth-story">
    <div class="auth-brand">
      <span class="brand-mark"><img src="/sabong-mark.png" alt="" /></span
      ><strong>SABONG</strong>
    </div>
    <div class="auth-story-content">
      <span class="auth-line"></span>
      <h1>Every bird has a story. Keep it all together.</h1>
      <p>
        Profiles, pedigree, care, and inventory in one clear view of your farm.
      </p>
      <div class="auth-feature-row">
        <span><Bird size={19} /> Bird records</span><span
          ><ShieldCheck size={19} /> Care schedules</span
        >
      </div>
    </div>
    <small>Farm management and record system</small>
  </div>
  <main class="auth-panel">
    <div class="auth-mobile-brand">
      <span class="brand-mark"><img src="/sabong-mark.png" alt="" /></span
      ><strong>SABONG</strong>
    </div>
    <div class="auth-card">
      <p class="kicker">Your farm workspace</p>
      <h2>
        {mode === "login"
          ? "Welcome back"
          : mode === "register"
            ? "Create your farm"
            : mode === "reset"
              ? "Choose a new password"
              : "Reset your password"}
      </h2>
      <p>
        {mode === "login"
          ? "Sign in to manage your farm."
          : mode === "register"
            ? "Set up a private space for your birds and records."
            : mode === "reset"
              ? "Save a new password, then sign in again."
              : "Enter your email to receive a recovery link."}
      </p>
      {#if !cloudConfigured}<p class="form-message" role="status">
          Cloud accounts are not configured on this installation. You can
          explore sample records below.
        </p>{/if}
      {#if auth.error}<p class="form-error" role="alert">{auth.error}</p>{/if}
      {#if auth.notice}<p class="form-message" role="status">
          {auth.notice}
        </p>{/if}
      <form onsubmit={submit} novalidate>
        {#if mode === "register"}<label class="field"
            ><span>Farm name</span><input
              bind:value={farm}
              aria-invalid={!!errors.farm}
              maxlength="120"
              autocomplete="organization"
              required
            />{#if errors.farm}<small class="field-error">{errors.farm}</small
              >{/if}</label
          >{/if}
        {#if mode !== "reset"}<label class="field"
            ><span>Email address</span><span class="input-icon"
              ><Mail size={18} /><input
                bind:value={email}
                aria-invalid={!!errors.email}
                type="email"
                placeholder="you@farm.com"
                autocomplete="email"
                required
              /></span
            >{#if errors.email}<small class="field-error">{errors.email}</small
              >{/if}</label
          >{/if}
        {#if mode !== "recover"}<label class="field"
            ><span>Password</span><span class="input-icon"
              ><LockKeyhole size={18} /><input
                bind:value={password}
                aria-invalid={!!errors.password}
                type="password"
                placeholder={mode === "login"
                  ? "Your password"
                  : "At least 8 characters"}
                autocomplete={mode === "login"
                  ? "current-password"
                  : "new-password"}
                required
              /></span
            >{#if errors.password}<small class="field-error"
                >{errors.password}</small
              >{/if}</label
          >{/if}
        {#if error}<p class="form-error" role="alert">
            {error}
          </p>{/if}{#if message}<p class="form-message" role="status">
            {message}
          </p>{/if}
        {#if mode === "login"}<button
            type="button"
            class="auth-link"
            onclick={() => switchMode("recover")}>Forgot password?</button
          >{/if}
        <button
          class="primary-button auth-submit"
          type="submit"
          disabled={busy || !cloudConfigured}
          >{busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : mode === "register"
                ? "Create farm"
                : mode === "reset"
                  ? "Save new password"
                  : "Send recovery link"}
          <ArrowRight size={17} /></button
        >
      </form>
      {#if mode === "login"}<p class="auth-switch">
          New to Sabong? <button onclick={() => switchMode("register")}
            >Create an account</button
          >
        </p>{:else}<p class="auth-switch">
          <button onclick={() => switchMode("login")}>Back to sign in</button>
        </p>{/if}
      {#if mode !== "reset"}<div class="demo-divider"><span>or</span></div>
        <button class="demo-button" onclick={onEnter}
          >Explore the UI demo <ArrowRight size={17} /></button
        >
        <p class="demo-note">
          Sample records are separate from real accounts and reset when you
          leave the demo.
        </p>{/if}
    </div>
  </main>
</div>

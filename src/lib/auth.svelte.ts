import type { Session, User } from "@supabase/supabase-js";
import { cloud, supabase, readableError, AUTH_STORAGE_KEY } from "./supabase";
import { store } from "./store.svelte";
export const INACTIVITY_MS = 60 * 60 * 1000;
class AuthState {
  user = $state<User | null>(null);
  ready = $state(false);
  loading = $state(false);
  recovering = $state(
    typeof window !== "undefined" &&
      new URLSearchParams(window.location.hash.slice(1)).get("type") ===
        "recovery",
  );
  error = $state("");
  notice = $state("");
  private signingOut = false;
  private sessionId = "";
  private generation = 0;
  private pending: Promise<void> | null = null;
  private pendingSessionId = "";
  private lastHeartbeat = 0;
  private activityKey() {
    return "sabong:last-active:" + this.sessionId;
  }
  private async acceptSession(session: Session | null): Promise<void> {
    if (!session) {
      this.generation++;
      this.user = null;
      this.sessionId = "";
      if (!store.demo) store.reset();
      this.ready = true;
      return;
    }
    // Token rotation keeps the same logical session. Never count rotation as user activity.
    const logical = JSON.parse(
      atob(
        session.access_token
          .split(".")[1]!
          .replace(/-/g, "+")
          .replace(/_/g, "/"),
      ),
    ).session_id as string;
    if (this.user?.id === session.user.id && this.sessionId === logical) return;
    if (this.pending) {
      if (this.pendingSessionId === logical) return this.pending;
      // A second account can arrive through another tab while the first loads.
      // Clear the previous workspace immediately and serialize the replacement.
      const pending = this.pending;
      this.generation++;
      this.user = null;
      this.sessionId = "";
      store.reset();
      await pending;
      return this.acceptSession(session);
    }
    const generation = ++this.generation;
    this.pendingSessionId = logical;
    this.loading = true;
    this.pending = (async () => {
      const { error } = await cloud().rpc("app_start_session");
      if (error) throw error;
      await store.refresh();
      if (generation !== this.generation) return;
      this.user = session.user;
      this.sessionId = logical;
      // The database remains authoritative across reloads and devices.
      const key = this.activityKey();
      if (!localStorage.getItem(key))
        localStorage.setItem(key, String(Date.now()));
      this.lastHeartbeat = Date.now();
      this.error = "";
    })()
      .catch(async (error) => {
        if (generation !== this.generation) return;
        this.error = readableError(error);
        this.user = null;
        this.sessionId = "";
        store.reset();
        await cloud().auth.signOut({ scope: "local" });
      })
      .finally(() => {
        this.pending = null;
        this.pendingSessionId = "";
        this.loading = false;
        this.ready = true;
      });
    return this.pending;
  }
  initialize() {
    if (!supabase) {
      this.ready = true;
      return () => {};
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (this.signingOut && session) return;
      if (event === "PASSWORD_RECOVERY") this.recovering = true;
      // Supabase auth callbacks must not await another auth call.
      setTimeout(() => {
        if (!this.signingOut || !session) void this.acceptSession(session);
      }, 0);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        this.error = readableError(error);
        this.ready = true;
      } else void this.acceptSession(data.session);
    });
    const activity = () => {
      if (!this.user || !this.sessionId) return;
      const now = Date.now(),
        key = this.activityKey(),
        previous = Number(localStorage.getItem(key) || now);
      if (now - previous >= INACTIVITY_MS) {
        void this.expire();
        return;
      }
      if (now - previous > 2000) localStorage.setItem(key, String(now));
      if (now - this.lastHeartbeat > 30000) {
        this.lastHeartbeat = now;
        void cloud()
          .rpc("app_touch_session")
          .then(({ error }) => {
            if (error) void this.expire();
          });
      }
    };
    const timer = setInterval(() => {
      if (
        this.user &&
        Date.now() - Number(localStorage.getItem(this.activityKey()) || 0) >=
          INACTIVITY_MS
      )
        void this.expire();
    }, 10000);
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((name) =>
      window.addEventListener(name, activity, { passive: true }),
    );
    return () => {
      subscription.unsubscribe();
      clearInterval(timer);
      events.forEach((name) => window.removeEventListener(name, activity));
    };
  }
  async signIn(email: string, password: string) {
    const { data, error } = await cloud().auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    await this.acceptSession(data.session);
    if (this.error) throw new Error(this.error);
  }
  async register(email: string, password: string, farm: string) {
    const { data, error } = await cloud().auth.signUp({
      email,
      password,
      options: {
        data: { farm_name: farm },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    if (data.session) await this.acceptSession(data.session);
    return Boolean(data.session);
  }
  async recover(email: string) {
    const { error } = await cloud().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/#type=recovery",
    });
    if (error) throw error;
  }
  async updatePassword(password: string) {
    const { error } = await cloud().auth.updateUser({ password });
    if (error) throw error;
    window.history.replaceState({}, "", window.location.pathname);
    await this.signOut();
    this.notice = "Password updated. Sign in with your new password.";
    this.recovering = false;
  }
  async signOut() {
    this.signingOut = true;
    this.generation++;
    const key = this.activityKey();
    this.user = null;
    this.sessionId = "";
    store.reset();
    localStorage.removeItem(key);
    if (!supabase) {
      this.signingOut = false;
      return;
    }
    try {
      const { error: revokeError } = await supabase.rpc("app_end_session");
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      if (revokeError)
        throw new Error(
          "Signed out on this device. Server revocation could not be confirmed; the server session will expire after inactivity.",
        );
    } finally {
      // A failed network logout must not leave a persistent token on a shared device.
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(AUTH_STORAGE_KEY + "-code-verifier");
      this.signingOut = false;
    }
  }
  private async expire() {
    if (!this.user) return;
    try {
      await this.signOut();
    } catch {
      // Local records were already cleared; the database will expire the session.
    } finally {
      this.error =
        "You were signed out after 60 minutes without activity. Sign in again.";
    }
  }
}
export const auth = new AuthState();

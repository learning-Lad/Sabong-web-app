export type PublicConfiguration =
  | { configured: true; url: string; key: string; error: "" }
  | { configured: false; url: ""; key: ""; error: string };

export function inspectPublicConfiguration(
  urlValue?: string,
  keyValue?: string,
): PublicConfiguration {
  const url = (urlValue || "").trim(),
    key = (keyValue || "").trim();
  const invalid = (error: string): PublicConfiguration => ({
    configured: false,
    url: "",
    key: "",
    error,
  });
  if (!url && !key) return invalid("");
  if (!url || !key)
    return invalid(
      "Set both the Supabase project URL and publishable key. See START_HERE.md.",
    );
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return invalid(
      "Use the complete Supabase HTTPS project URL, starting with https://.",
    );
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (
    (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) ||
    parsed.username ||
    parsed.password ||
    !["", "/"].includes(parsed.pathname) ||
    parsed.search ||
    parsed.hash ||
    /YOUR_|REPLACE_/i.test(url)
  ) {
    return invalid(
      "Use your Supabase project URL from its Connect dialog, without /rest/v1 or another path.",
    );
  }
  if (key.startsWith("sb_secret_"))
    return invalid(
      "A secret/service-role key cannot be used in VITE_SUPABASE_PUBLISHABLE_KEY. Use the publishable key.",
    );
  if (
    key.startsWith("sb_publishable_") &&
    /^sb_publishable_[A-Za-z0-9_-]+$/.test(key) &&
    !/YOUR_|REPLACE_/i.test(key)
  ) {
    return { configured: true, url: parsed.origin, key, error: "" };
  }
  if (key.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(
        atob(key.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role === "anon")
        return { configured: true, url: parsed.origin, key, error: "" };
      return invalid(
        "Use the legacy anon key, never a service_role key, in browser settings.",
      );
    } catch {
      return invalid(
        "The Supabase key is incomplete. Copy the full publishable key or legacy anon key.",
      );
    }
  }
  return invalid(
    "Use a Supabase publishable key beginning sb_publishable_, or a legacy anon key.",
  );
}

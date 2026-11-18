import { createClient } from "@supabase/supabase-js";
import { inspectPublicConfiguration } from "../../config/public-env";
const settings = inspectPublicConfiguration(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export const AUTH_STORAGE_KEY = "sabong-web-auth";
export const cloudConfigured = settings.configured;
export const cloudConfigurationError = settings.error;
export const supabase = settings.configured
  ? createClient(settings.url, settings.key, {
      auth: {
        storageKey: AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
      },
    })
  : null;
export function cloud() {
  if (!supabase)
    throw new Error(
      "Cloud connection is not configured. Follow DEPLOYMENT.md to enable real accounts.",
    );
  return supabase;
}
export function readableError(error: unknown): string {
  const item = error as { message?: string; code?: string };
  if (item?.code === "42P01" || item?.code === "PGRST205")
    return "The cloud workspace has not been set up. Contact the farm operator.";
  if (item?.code === "23503")
    return "This record is still linked to other records. Update those links first.";
  if (item?.code === "23505")
    return "That record already exists. Choose another name or refresh the page.";
  if (item?.code === "23514")
    return "Check the dates and quantities. Stock cannot fall below zero.";
  if (item?.code === "42501")
    return "Your session expired or this record belongs to another farm. Sign in again.";
  return (
    item?.message ||
    "The request could not be completed. Check your connection and try again."
  );
}

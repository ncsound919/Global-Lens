import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Ecosystem shared auth (Supabase, auth-only) — frontend.
 *
 * Replaces the old direct Google OAuth popup flow. Sign-in goes through the
 * shared Overlay365 Supabase project (signInWithOAuth google); the resulting
 * Supabase access token is POSTed to /api/auth/ecosystem/session, where the
 * server verifies it via <url>/auth/v1/user and links/creates the local user
 * row by verified email, issuing the existing bgl_session cookie.
 *
 * Only the project URL is defaulted in code (public, not a secret). The anon
 * key MUST come from VITE_ECOSYSTEM_SUPABASE_ANON_KEY — when absent this
 * module reports unconfigured and the Google button stays hidden; local
 * email/password login is unaffected.
 */

export const ECOSYSTEM_SUPABASE_URL_DEFAULT =
  "https://hjjgsbejhkwiyghncobe.supabase.co";

export function getEcosystemSupabaseUrl(): string {
  return (
    import.meta.env.VITE_ECOSYSTEM_SUPABASE_URL ||
    ECOSYSTEM_SUPABASE_URL_DEFAULT
  );
}

export function getEcosystemSupabaseAnonKey(): string {
  return import.meta.env.VITE_ECOSYSTEM_SUPABASE_ANON_KEY || "";
}

/** False when unconfigured — UI must hide the Google button, never fake auth. */
export function isEcosystemAuthConfigured(): boolean {
  return getEcosystemSupabaseAnonKey().length > 0;
}

let client: SupabaseClient | null = null;

/** Null when unconfigured. Singleton so the post-redirect session persists. */
export function getEcosystemClient(): SupabaseClient | null {
  if (!isEcosystemAuthConfigured()) return null;
  if (!client) {
    client = createClient(
      getEcosystemSupabaseUrl(),
      getEcosystemSupabaseAnonKey()
    );
  }
  return client;
}

/** Redirects to Supabase → Google. Throws with an honest message when unconfigured. */
export async function signInWithEcosystemGoogle(): Promise<void> {
  const sb = getEcosystemClient();
  if (!sb) {
    throw new Error(
      "Shared Google sign-in is not configured (VITE_ECOSYSTEM_SUPABASE_ANON_KEY unset)."
    );
  }
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export interface LinkedLocalUser {
  id: string;
  email: string;
}

/**
 * If a Supabase session exists (e.g. after the OAuth redirect back to the
 * app), verify it server-side and link it to a local user row. Returns the
 * local user, or null when there is no Supabase session to link.
 */
export async function linkEcosystemSession(): Promise<LinkedLocalUser | null> {
  const sb = getEcosystemClient();
  if (!sb) return null;
  const { data, error } = await sb.auth.getSession();
  if (error || !data.session?.access_token) return null;
  const res = await fetch("/api/auth/ecosystem/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: data.session.access_token }),
  });
  const body = (await res.json()) as {
    success?: boolean;
    user?: LinkedLocalUser;
    error?: string;
  };
  if (!res.ok || !body.success || !body.user) {
    throw new Error(body.error || "Failed to link shared sign-in.");
  }
  return body.user;
}

/** Best-effort Supabase sign-out (local bgl_session logout is separate). */
export async function signOutEcosystem(): Promise<void> {
  try {
    await getEcosystemClient()?.auth.signOut();
  } catch {
    /* linking state lives server-side in bgl_session; ignore */
  }
}

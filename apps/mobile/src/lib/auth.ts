/**
 * Anonymous auth (§3.6): instant play, no signup. Requires the Anonymous
 * provider toggle in the Supabase dashboard (Auth → Sign In / Up).
 */
import { supabase } from "./supabase";

export async function ensureSession(): Promise<{ userId: string } | { error: string }> {
  const { data: current } = await supabase.auth.getSession();
  if (current.session) return { userId: current.session.user.id };
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) {
    return { error: error?.message ?? "auth failed" };
  }
  return { userId: data.session.user.id };
}

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

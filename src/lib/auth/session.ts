// Server-side session helpers. Mock mode: signed username cookie backed by
// .mock/users.json. Supabase mode: the @supabase/ssr session, with the
// username recovered from the synthetic "<username>@wealth.local" email.

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/mock/mode";
import { createSessionToken, verifySessionToken } from "@/lib/mock/users";

export const SESSION_COOKIE = "wd_session";

/** Signed-in username, or null. The (app) layout redirects on null. */
export async function getCurrentUser(): Promise<string | null> {
  if (isMockMode()) {
    const store = await cookies();
    return verifySessionToken(store.get(SESSION_COOKIE)?.value);
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  return email ? email.split("@")[0] : null;
}

export async function setSessionCookie(username: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(username), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // No auto logout for now — keep the session for a year.
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

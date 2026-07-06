"use server";

// Username + 4-digit PIN auth, reused from the Split project's create/login
// service. Mock mode verifies against .mock/users.json and sets a signed
// cookie; Supabase mode maps the same credentials onto Supabase email auth
// via a synthetic "<username>@wealth.local" address (PIN padded to meet the
// minimum password length) so both branches stay in sync.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/mock/mode";
import { claimUser, verifyUserDetailed } from "@/lib/mock/users";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { isValidPin, normalizeUsername } from "@/lib/auth/shared";

export interface AuthState {
  error: string | null;
}

function readCredentials(formData: FormData): { username: string; pin: string } | { error: string } {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const pin = String(formData.get("pin") ?? "");
  if (!username) return { error: "Username is required." };
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return { error: "Username can only use letters, numbers, dots, dashes and underscores." };
  }
  if (!isValidPin(pin)) return { error: "PIN must be exactly 4 digits." };
  return { username, pin };
}

function supabasePassword(pin: string): string {
  return `wd-pin-${pin}`; // Supabase requires ≥6 chars; the PIN alone is 4.
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const creds = readCredentials(formData);
  if ("error" in creds) return { error: creds.error };

  if (isMockMode()) {
    const result = verifyUserDetailed(creds.username, creds.pin);
    if (result === "not_found") return { error: "Account doesn't exist." };
    if (result === "wrong_pin") return { error: "Wrong PIN." };
    await setSessionCookie(creds.username);
  } else {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: `${creds.username}@wealth.local`,
      password: supabasePassword(creds.pin),
    });
    if (error) return { error: "Wrong username or PIN." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const creds = readCredentials(formData);
  if ("error" in creds) return { error: creds.error };
  const confirm = String(formData.get("pin_confirm") ?? "");
  if (confirm !== creds.pin) return { error: "PINs don't match." };

  if (isMockMode()) {
    const failed = claimUser(creds.username, creds.pin);
    if (failed === "username_taken") return { error: "That username is already taken." };
    await setSessionCookie(creds.username);
  } else {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: `${creds.username}@wealth.local`,
      password: supabasePassword(creds.pin),
    });
    if (error) return { error: "That username is already taken." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  if (isMockMode()) {
    await clearSessionCookie();
  } else {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/login");
}

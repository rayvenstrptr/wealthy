/**
 * Local mock mode: active whenever Supabase env vars are not configured.
 * Data lives in .mock/db.json and auth is bypassed. Setting
 * NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 * switches the whole app to the real backend — no code changes.
 */
export function isMockMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL;
}

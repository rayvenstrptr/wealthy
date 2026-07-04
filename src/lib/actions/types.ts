export type ActionResult = { ok: true } | { ok: false; error: string };

export type ActionResultWithId = { ok: true; id: string } | { ok: false; error: string };

export function failure(error: unknown, fallback: string): { ok: false; error: string } {
  if (error && typeof error === "object" && "message" in error) {
    return { ok: false, error: String((error as { message: unknown }).message) };
  }
  return { ok: false, error: fallback };
}

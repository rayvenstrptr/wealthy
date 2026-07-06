// Username + 4-digit PIN credentials, reused from the Split project's cloud
// vault service. Client-safe: pure string checks only.

/** Normalized username key — case/space-insensitive, matched server-side too. */
export function normalizeUsername(username: string): string {
  return username.toLowerCase().trim();
}

/** A PIN must be exactly four digits. */
export function isValidPin(pin: string): boolean {
  return /^[0-9]{4}$/.test(pin);
}

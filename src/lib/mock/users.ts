// File-backed user store for local mock mode — the mock-mode counterpart of the
// Split project's Supabase vault (username + 4-digit PIN, hash checked
// server-side). Lives in .mock/users.json, SEPARATE from db.json so reseeding
// demo data never wipes accounts. Data itself stays single-store: auth is a
// gate, not multi-tenancy.

import fs from "node:fs";
import path from "node:path";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { normalizeUsername } from "@/lib/auth/shared";

interface MockUser {
  username: string;
  salt: string;
  pin_hash: string;
  created_at: string;
}

interface UsersFile {
  /** Signs the session cookie so it can't be forged by editing the browser. */
  session_secret: string;
  users: MockUser[];
}

const DIR = path.join(process.cwd(), ".mock");
const USERS_PATH = path.join(DIR, "users.json");

function loadUsers(): UsersFile {
  if (fs.existsSync(USERS_PATH)) {
    return JSON.parse(fs.readFileSync(USERS_PATH, "utf8")) as UsersFile;
  }
  const fresh: UsersFile = { session_secret: randomBytes(32).toString("hex"), users: [] };
  saveUsers(fresh);
  return fresh;
}

function saveUsers(file: UsersFile): void {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(USERS_PATH, JSON.stringify(file, null, 2));
}

function hashPin(pin: string, salt: string): string {
  return scryptSync(pin, salt, 32).toString("hex");
}

export type MockAuthError = "username_taken" | "invalid_credentials";

/** Register a brand-new username. Returns an error code instead of throwing. */
export function claimUser(username: string, pin: string): MockAuthError | null {
  const file = loadUsers();
  const u = normalizeUsername(username);
  if (file.users.some((user) => user.username === u)) return "username_taken";
  const salt = randomBytes(16).toString("hex");
  file.users.push({
    username: u,
    salt,
    pin_hash: hashPin(pin, salt),
    created_at: new Date().toISOString(),
  });
  saveUsers(file);
  return null;
}

/** Check username + PIN against the stored hash. */
export function verifyUser(username: string, pin: string): boolean {
  const file = loadUsers();
  const user = file.users.find((u) => u.username === normalizeUsername(username));
  if (!user) return false;
  const expected = Buffer.from(user.pin_hash, "hex");
  const actual = Buffer.from(hashPin(pin, user.salt), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Like verifyUser but distinguishes "no such account" from "wrong PIN". */
export function verifyUserDetailed(
  username: string,
  pin: string,
): "ok" | "not_found" | "wrong_pin" {
  const file = loadUsers();
  const user = file.users.find((u) => u.username === normalizeUsername(username));
  if (!user) return "not_found";
  const expected = Buffer.from(user.pin_hash, "hex");
  const actual = Buffer.from(hashPin(pin, user.salt), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual)
    ? "ok"
    : "wrong_pin";
}

function sign(username: string, secret: string): string {
  return createHmac("sha256", secret).update(username).digest("hex");
}

/** Cookie value: "username.hmac". No expiry — no auto logout for now. */
export function createSessionToken(username: string): string {
  const file = loadUsers();
  const u = normalizeUsername(username);
  return `${u}.${sign(u, file.session_secret)}`;
}

/** Username for a valid token, or null (tampered / from a wiped store). */
export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const username = token.slice(0, dot);
  const file = loadUsers();
  if (!file.users.some((u) => u.username === username)) return null;
  const expected = Buffer.from(sign(username, file.session_secret));
  const actual = Buffer.from(token.slice(dot + 1));
  return expected.length === actual.length && timingSafeEqual(expected, actual)
    ? username
    : null;
}

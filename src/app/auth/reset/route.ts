import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

// Escape hatch for a stale/forged session cookie (e.g. .mock/users.json was
// deleted while the browser still holds a cookie). A server component can't
// clear cookies, so the (app) layout redirects here; middleware would loop
// /login → / forever otherwise, because it only checks cookie presence.
export async function GET(request: Request) {
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/login", request.url));
}

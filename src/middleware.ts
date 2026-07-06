import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const SESSION_COOKIE = "wd_session"; // mirrors src/lib/auth/session.ts (edge can't import node:fs code)

export async function middleware(request: NextRequest) {
  // Mock mode (no Supabase configured): username+PIN sessions in a signed
  // cookie. Middleware only routes on cookie PRESENCE — the (app) layout
  // verifies the signature server-side and re-redirects if it's forged.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
    const isLoginPage = request.nextUrl.pathname.startsWith("/login");

    if (!hasSession && !isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    if (hasSession && isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// Every console page needs a signed-in curator; without a session, go to the
// sign-in page and come back afterwards. (A wrong or changed code is caught by
// the API, which then sends the curator here too.)
export function middleware(req: NextRequest) {
  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = req.nextUrl.clone();
  const back = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = "/signin";
  url.search = back === "/" ? "" : `?next=${encodeURIComponent(back)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!signin|_next|favicon.ico).*)"],
};

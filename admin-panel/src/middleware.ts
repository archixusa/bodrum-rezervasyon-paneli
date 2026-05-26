import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Perf: skip middleware entirely for static/asset/internal paths via matcher below.
// For auth route fast-paths, we just check session cookie presence — no network call.

function hasSessionCookie(req: NextRequest): boolean {
  for (const c of req.cookies.getAll()) {
    if (c.name.startsWith("sb-") && c.name.includes("-auth-token")) {
      return true;
    }
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isAuthRoute = path === "/login" || path.startsWith("/auth");

  // Fast path: auth routes — trust cookie presence
  if (isAuthRoute) {
    if (hasSessionCookie(req)) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request: req });
  }

  // No cookie at all → redirect to login without contacting Supabase
  if (!hasSessionCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Cookie present — refresh via Supabase SSR (validates + rotates tokens)
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    // Skip all internal/static/asset paths
    "/((?!_next/static|_next/image|_next/data|favicon.ico|icon.svg|manifest.json|sw.js|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|css|js|map|woff2?|ttf|mp3|json)).*)",
  ],
};

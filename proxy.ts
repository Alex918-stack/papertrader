import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest } from "next/server";

// Named `proxy.ts`, not `middleware.ts` - this Next.js version (16) renamed
// the file convention. Same mechanism either way: this runs on the server
// before a matched request is handled.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every route except static assets and images - those never
     * need a session check, and running on them would just add latency to
     * every CSS/JS/image request for no benefit.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

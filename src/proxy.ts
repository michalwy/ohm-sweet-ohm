import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getLastWorkspaceCookieOptions,
  LAST_WORKSPACE_COOKIE_NAME
} from "@/lib/lastWorkspaceCookie";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const workspaceSlug = getWorkspaceSlugFromPath(request.nextUrl.pathname);

  if (workspaceSlug) {
    response.cookies.set(
      LAST_WORKSPACE_COOKIE_NAME,
      workspaceSlug,
      getLastWorkspaceCookieOptions()
    );
  }

  return response;
}

export const config = {
  matcher: "/w/:path*"
};

function getWorkspaceSlugFromPath(pathname: string) {
  const [, routeSegment, slugSegment] = pathname.split("/");

  if (routeSegment !== "w" || !slugSegment) {
    return "";
  }

  try {
    return decodeURIComponent(slugSegment);
  } catch {
    return "";
  }
}

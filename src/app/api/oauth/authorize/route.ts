import { auth } from "@/server/auth/auth";
import {
  decideAuthorization,
  getOAuthBaseUrl,
  readAuthorizationParams
} from "@/server/oauth/oauthServer";

/**
 * The consent screen's answer (#322). The form at `/oauth/authorize` posts here; the signed-in
 * user's session approves or denies, and the browser is sent back to the client with a code or an
 * error. A cross-site post is refused (`Origin` must be this app), so another site cannot approve
 * on the user's behalf.
 */
export async function POST(request: Request) {
  const base = new URL(getOAuthBaseUrl());

  if (request.headers.get("origin") !== base.origin) {
    return new Response("Forbidden", { status: 403 });
  }

  const form = await request.formData();
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : null;
  };
  const params = readAuthorizationParams(field);
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return redirectToConsent(base, params, "signed-out");
  }

  const approve = field("decision") === "approve";
  const access = field("access");
  const result = await decideAuthorization(
    session.user.id,
    params,
    approve
      ? {
          approve: true,
          workspaceId: field("workspaceId") ?? "",
          access: access === "read-write" ? "read-write" : "read-only"
        }
      : { approve: false }
  );

  if (!result.ok) {
    return redirectToConsent(base, params, result.show);
  }

  return Response.redirect(result.redirect, 303);
}

function redirectToConsent(base: URL, params: Record<string, string>, notice: string) {
  const url = new URL("/oauth/authorize", base);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("notice", notice);

  return Response.redirect(url.toString(), 303);
}

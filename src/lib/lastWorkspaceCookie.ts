export const LAST_WORKSPACE_COOKIE_NAME = "oso_last_workspace_slug";

const lastWorkspaceCookieMaxAge = 60 * 60 * 24 * 365;

export function getLastWorkspaceCookieOptions() {
  return {
    httpOnly: true,
    maxAge: lastWorkspaceCookieMaxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: shouldUseSecureCookies()
  };
}

function shouldUseSecureCookies() {
  const authUrl = process.env.BETTER_AUTH_URL;

  if (!authUrl) {
    return process.env.NODE_ENV === "production";
  }

  try {
    return new URL(authUrl).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

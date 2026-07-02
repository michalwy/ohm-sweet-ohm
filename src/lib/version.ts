/**
 * Application version.
 *
 * The production container image bakes the release version into the OSO_VERSION
 * environment variable at build time from the git tag (see the OSO_VERSION build
 * arg in the Dockerfile and the publish-image CI job). Local and non-release
 * builds fall back to "dev".
 */
export function getAppVersion(): string {
  const version = process.env.OSO_VERSION?.trim();
  return version && version.length > 0 ? version : "dev";
}

/**
 * Human-facing label for the app version, e.g. "v1.4.0" for a release or "dev"
 * for local/non-release builds.
 */
export function getAppVersionLabel(): string {
  const version = getAppVersion();
  return version === "dev" ? "dev" : `v${version}`;
}

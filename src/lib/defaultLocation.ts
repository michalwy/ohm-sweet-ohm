/**
 * Which storage location a location picker preselects for a part (#39).
 *
 * A part's own default location wins. Only a part with none falls back to the workspace's default
 * location (Settings → Inventory). The result is preselected only when it is one of the locations
 * the picker offers (for example assignable and not archived); otherwise the picker starts empty,
 * as it always did for a part whose default cannot be used.
 *
 * Pure logic only — no server, Prisma or i18n imports — so it is unit-testable in isolation.
 */
export function resolvePreselectedLocationId(
  partDefaultLocationId: string | null | undefined,
  workspaceDefaultLocationId: string | null | undefined,
  selectableLocations: readonly { id: string }[]
): string {
  const candidate = partDefaultLocationId || workspaceDefaultLocationId || null;

  if (!candidate) {
    return "";
  }

  return selectableLocations.some((location) => location.id === candidate) ? candidate : "";
}

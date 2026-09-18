export type LocationTreeNode = {
  id: string;
  parentId: string | null;
  name: string;
};

export const LOCATION_PATH_SEPARATOR = " / ";

/** The location itself followed by every location below it, however deep. */
export function getLocationSubtreeIds(
  locations: Array<{ id: string; parentId: string | null }>,
  locationId: string
): string[] {
  const childrenByParentId = new Map<string, string[]>();
  for (const location of locations) {
    if (!location.parentId) continue;
    const siblings = childrenByParentId.get(location.parentId) ?? [];
    siblings.push(location.id);
    childrenByParentId.set(location.parentId, siblings);
  }

  const subtreeIds = [locationId];
  const seen = new Set(subtreeIds);
  for (let index = 0; index < subtreeIds.length; index += 1) {
    for (const childId of childrenByParentId.get(subtreeIds[index]) ?? []) {
      if (!seen.has(childId)) {
        seen.add(childId);
        subtreeIds.push(childId);
      }
    }
  }

  return subtreeIds;
}

/**
 * Where `locationId` sits below `rootId`: the path under the root (e.g. "Drawer 5 / Bin 2" below
 * "Cabinet A"), or the root's own name when the two are the same location. Falls back to the
 * location's own name when `rootId` is not one of its ancestors.
 */
export function getLocationPathBelow(
  locations: LocationTreeNode[],
  rootId: string,
  locationId: string
): string {
  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const ownName = locationsById.get(locationId)?.name ?? "";
  if (locationId === rootId) {
    return ownName;
  }

  const names: string[] = [];
  const seen = new Set<string>();
  let current = locationsById.get(locationId);

  while (current && !seen.has(current.id)) {
    if (current.id === rootId) {
      return names.join(LOCATION_PATH_SEPARATOR);
    }
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? locationsById.get(current.parentId) : undefined;
  }

  return ownName;
}

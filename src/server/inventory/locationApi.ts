import "server-only";

import type { WorkspaceActor } from "@/server/access-control/actor";
import { implementOperation } from "@/server/api/execute";
import {
  buildStorageLocationPaths,
  createStorageLocation,
  deleteStorageLocation,
  generateStorageLocations,
  getStorageLocations,
  patchStorageLocation,
  type StorageLocationListItem
} from "@/server/inventory/locationMutations";
import {
  createLocationOperation,
  deleteLocationOperation,
  generateLocationsOperation,
  getLocationOperation,
  listLocationsOperation,
  updateLocationOperation
} from "@/server/inventory/locationOperations";

/**
 * The storage location operations (#280), over the same domain functions as the server actions in
 * `locationActions.ts`. Every call is scoped to the actor's workspace; the permission is checked by
 * `executeOperation` before the function runs.
 */

/** Every location of the workspace with its full path, and a lookup that adds the path to one. */
async function readLocations(actor: WorkspaceActor) {
  const locations = await getStorageLocations(actor.workspace.id);
  const paths = buildStorageLocationPaths(locations);
  const withPath = (location: StorageLocationListItem) => ({
    id: location.id,
    parentId: location.parentId,
    name: location.name,
    path: paths.get(location.id) ?? location.name,
    isAssignable: location.isAssignable,
    isArchived: location.isArchived
  });

  return { locations, withPath };
}

async function readLocation(actor: WorkspaceActor, id: string) {
  const { locations, withPath } = await readLocations(actor);
  const location = locations.find((candidate) => candidate.id === id);

  if (!location) {
    throw new Error("location-not-found");
  }

  return withPath(location);
}

export const listLocationsImplementation = implementOperation(
  listLocationsOperation,
  async (actor) => {
    const { locations, withPath } = await readLocations(actor);

    return { items: locations.map(withPath) };
  }
);

export const getLocationImplementation = implementOperation(
  getLocationOperation,
  async (actor, input) => readLocation(actor, input.id)
);

export const createLocationImplementation = implementOperation(
  createLocationOperation,
  async (actor, input) => {
    const location = await createStorageLocation({ workspaceId: actor.workspace.id, ...input });

    return readLocation(actor, location.id);
  }
);

export const updateLocationImplementation = implementOperation(
  updateLocationOperation,
  async (actor, input) => {
    const location = await patchStorageLocation({ workspaceId: actor.workspace.id, ...input });

    return readLocation(actor, location.id);
  }
);

export const deleteLocationImplementation = implementOperation(
  deleteLocationOperation,
  async (actor, input) => {
    await deleteStorageLocation({ workspaceId: actor.workspace.id, locationId: input.id });

    return { id: input.id };
  }
);

export const generateLocationsImplementation = implementOperation(
  generateLocationsOperation,
  async (actor, input) => {
    const result = await generateStorageLocations({
      workspaceId: actor.workspace.id,
      parentId: input.parentId ?? null,
      levels: input.levels
    });
    const { withPath } = await readLocations(actor);

    return { created: result.created.map(withPath), reusedCount: result.reusedCount };
  }
);

"use server";


import { getAuthorizedSessionActor } from "@/server/auth/currentActor";
import type { LocationGeneratorLevel } from "@/lib/locationGenerator";
import { parseActionInput } from "@/server/api/actionInput";
import {
  createLocationOperation,
  deleteLocationOperation,
  generateLocationsOperation,
  updateLocationOperation
} from "@/server/inventory/locationOperations";
import {
  createStorageLocation,
  deleteStorageLocation,
  generateStorageLocations,
  getStorageLocations,
  patchStorageLocation,
  type StorageLocationListItem
} from "@/server/inventory/locationMutations";

export type LocationActionResult<T> =
  | {
      ok: true;
      data: T;
      submittedAt: number;
    }
  | {
      ok: false;
      error: string;
      submittedAt: number;
    };

export async function getLocationsForWorkspace(input: {
  workspaceSlug: string;
}): Promise<LocationActionResult<StorageLocationListItem[]>> {
  try {
    const context = await getAuthorizedLocationContext({
      workspaceSlug: input.workspaceSlug,
      permission: "locations:read"
    });
    return getSuccessState(await getStorageLocations(context.workspace.id));
  } catch (error) {
    return getErrorState(getLocationActionError(error));
  }
}

export async function createLocationForWorkspace(input: {
  workspaceSlug: string;
  parentId?: string | null;
  name: string;
  isAssignable: boolean;
}): Promise<LocationActionResult<StorageLocationListItem>> {
  try {
    const context = await getAuthorizedLocationContext({
      workspaceSlug: input.workspaceSlug,
      permission: "locations:write"
    });
    const data = parseActionInput(createLocationOperation, {
      parentId: input.parentId,
      name: input.name,
      isAssignable: input.isAssignable
    });
    const location = await createStorageLocation({
      workspaceId: context.workspace.id,
      ...data
    });
    return getSuccessState(location);
  } catch (error) {
    return getErrorState(getLocationActionError(error));
  }
}

export async function updateLocationForWorkspace(input: {
  workspaceSlug: string;
  locationId: string;
  parentId?: string | null;
  name: string;
  isAssignable: boolean;
  isArchived: boolean;
}): Promise<LocationActionResult<StorageLocationListItem>> {
  try {
    const context = await getAuthorizedLocationContext({
      workspaceSlug: input.workspaceSlug,
      permission: "locations:write"
    });
    const location = await patchStorageLocation({
      workspaceId: context.workspace.id,
      ...parseActionInput(updateLocationOperation, {
        id: input.locationId,
        parentId: input.parentId ?? null,
        name: input.name,
        isAssignable: input.isAssignable,
        isArchived: input.isArchived
      })
    });
    return getSuccessState(location);
  } catch (error) {
    return getErrorState(getLocationActionError(error));
  }
}

export async function generateLocationsForWorkspace(input: {
  workspaceSlug: string;
  parentId: string | null;
  levels: LocationGeneratorLevel[];
}): Promise<
  LocationActionResult<{ created: StorageLocationListItem[]; reusedCount: number }>
> {
  try {
    const context = await getAuthorizedLocationContext({
      workspaceSlug: input.workspaceSlug,
      permission: "locations:write"
    });
    const data = parseActionInput(generateLocationsOperation, {
      parentId: input.parentId || null,
      levels: input.levels
    });
    return getSuccessState(
      await generateStorageLocations({
        workspaceId: context.workspace.id,
        parentId: data.parentId ?? null,
        levels: data.levels
      })
    );
  } catch (error) {
    return getErrorState(getLocationActionError(error));
  }
}

export async function deleteLocationForWorkspace(input: {
  workspaceSlug: string;
  locationId: string;
}): Promise<LocationActionResult<null>> {
  try {
    const context = await getAuthorizedLocationContext({
      workspaceSlug: input.workspaceSlug,
      permission: "locations:write"
    });
    const { id } = parseActionInput(deleteLocationOperation, { id: input.locationId });
    await deleteStorageLocation({
      workspaceId: context.workspace.id,
      locationId: id
    });
    return getSuccessState(null);
  } catch (error) {
    return getErrorState(getLocationActionError(error));
  }
}

async function getAuthorizedLocationContext({
  workspaceSlug,
  permission
}: {
  workspaceSlug: string;
  permission: "locations:read" | "locations:write";
}) {
  return getAuthorizedSessionActor(workspaceSlug, permission);
}

function getSuccessState<T>(data: T): LocationActionResult<T> {
  return {
    ok: true,
    data,
    submittedAt: Date.now()
  };
}

function getErrorState(error: string): LocationActionResult<never> {
  return {
    ok: false,
    error,
    submittedAt: Date.now()
  };
}

function getLocationActionError(error: unknown) {
  if (!(error instanceof Error)) {
    return "database-unavailable";
  }

  return error.message.replaceAll("_", "-");
}

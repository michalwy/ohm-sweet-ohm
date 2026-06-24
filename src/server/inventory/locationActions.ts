"use server";


import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import {
  createStorageLocation,
  deleteStorageLocation,
  getStorageLocations,
  updateStorageLocation,
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
    const location = await createStorageLocation({
      workspaceId: context.workspace.id,
      parentId: input.parentId,
      name: input.name,
      isAssignable: input.isAssignable
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
    const location = await updateStorageLocation({
      workspaceId: context.workspace.id,
      locationId: input.locationId,
      parentId: input.parentId,
      name: input.name,
      isAssignable: input.isAssignable,
      isArchived: input.isArchived
    });
    return getSuccessState(location);
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
    await deleteStorageLocation({
      workspaceId: context.workspace.id,
      locationId: input.locationId
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
  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);
  if (!context) {
    throw new Error("workspace-not-found");
  }

  await authorizeWorkspacePermission({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    permission
  });

  return context;
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

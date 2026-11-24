"use server";


import { Prisma } from "@/generated/prisma/client";
import { getAuthorizedSessionActor } from "@/server/auth/currentActor";
import { parseOperationInput, type OperationInput } from "@/server/api/operations";
import type { ListPage } from "@/server/pagination";
import {
  createUnit,
  deleteUnit,
  getUnitsPageForWorkspace as getUnitsPage,
  getWorkspaceUnits,
  updateUnit,
  type UnitListItem
} from "@/server/units/unitMutations";
import { listUnitsOperation } from "@/server/units/unitOperations";

export type UnitActionResult<T> =
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

export async function getUnitsForWorkspace(input: {
  workspaceSlug: string;
}): Promise<UnitActionResult<UnitListItem[]>> {
  try {
    const context = await getAuthorizedUnitsContext({
      workspaceSlug: input.workspaceSlug,
      permission: "units:read"
    });

    return getSuccessState(await getWorkspaceUnits(context.workspace.id));
  } catch (error) {
    return getErrorState(getUnitActionError(error));
  }
}

export async function getUnitsPageForWorkspace(
  input: { workspaceSlug: string } & OperationInput<typeof listUnitsOperation>
): Promise<UnitActionResult<ListPage<UnitListItem>>> {
  try {
    const { workspaceSlug, ...rawInput } = input;
    const parsed = parseOperationInput(listUnitsOperation, rawInput);

    if (!parsed.ok) {
      return getErrorState(parsed.error.code);
    }

    const context = await getAuthorizedUnitsContext({
      workspaceSlug,
      permission: listUnitsOperation.permission
    });

    return getSuccessState(
      await getUnitsPage({
        workspaceId: context.workspace.id,
        ...parsed.data
      })
    );
  } catch (error) {
    return getErrorState(getUnitActionError(error));
  }
}

export async function createUnitForWorkspace(input: {
  workspaceSlug: string;
  name: string;
  symbol: string;
  allowsFraction: boolean;
}): Promise<UnitActionResult<UnitListItem>> {
  try {
    const context = await getAuthorizedUnitsContext({
      workspaceSlug: input.workspaceSlug,
      permission: "units:write"
    });
    const unit = await createUnit({
      workspaceId: context.workspace.id,
      name: input.name,
      symbol: input.symbol,
      allowsFraction: input.allowsFraction
    });

    return getSuccessState(unit);
  } catch (error) {
    return getErrorState(getUnitActionError(error));
  }
}

export async function updateUnitForWorkspace(input: {
  workspaceSlug: string;
  unitId: string;
  name: string;
  symbol: string;
  allowsFraction: boolean;
}): Promise<UnitActionResult<UnitListItem>> {
  try {
    const context = await getAuthorizedUnitsContext({
      workspaceSlug: input.workspaceSlug,
      permission: "units:write"
    });
    const unit = await updateUnit({
      workspaceId: context.workspace.id,
      unitId: input.unitId,
      name: input.name,
      symbol: input.symbol,
      allowsFraction: input.allowsFraction
    });

    return getSuccessState(unit);
  } catch (error) {
    return getErrorState(getUnitActionError(error));
  }
}

export async function deleteUnitForWorkspace(input: {
  workspaceSlug: string;
  unitId: string;
}): Promise<UnitActionResult<null>> {
  try {
    const context = await getAuthorizedUnitsContext({
      workspaceSlug: input.workspaceSlug,
      permission: "units:write"
    });
    await deleteUnit({
      workspaceId: context.workspace.id,
      unitId: input.unitId
    });

    return getSuccessState(null);
  } catch (error) {
    return getErrorState(getUnitActionError(error));
  }
}

async function getAuthorizedUnitsContext({
  workspaceSlug,
  permission
}: {
  workspaceSlug: string;
  permission: "units:read" | "units:write";
}) {
  return getAuthorizedSessionActor(workspaceSlug, permission);
}

function getSuccessState<T>(data: T): UnitActionResult<T> {
  return {
    ok: true,
    data,
    submittedAt: Date.now()
  };
}

function getErrorState(error: string): UnitActionResult<never> {
  return {
    ok: false,
    error,
    submittedAt: Date.now()
  };
}

function getUnitActionError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "duplicate-unit-name";
    }

    if (error.code === "P2003") {
      return "unit-in-use";
    }
  }

  if (!(error instanceof Error)) {
    return "database-unavailable";
  }

  return error.message.replaceAll("_", "-");
}

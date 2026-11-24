import "server-only";

import { withDomainErrors } from "@/server/api/domainErrors";
import { implementOperation } from "@/server/api/execute";
import { prisma } from "@/server/db/prisma";
import {
  createUnit,
  deleteUnit,
  getUnitsPageForWorkspace,
  updateUnit
} from "@/server/units/unitMutations";
import {
  createUnitOperation,
  deleteUnitOperation,
  listUnitsOperation,
  updateUnitOperation
} from "@/server/units/unitOperations";

/** Units of measure in the API and MCP (#278), over the same domain functions as the units page. */

const unitErrors = { unique: "duplicate-unit-name", foreignKey: "unit-in-use" };

export const listUnitsImplementation = implementOperation(listUnitsOperation, (actor, input) =>
  getUnitsPageForWorkspace({ workspaceId: actor.workspace.id, ...input })
);

export const createUnitImplementation = implementOperation(createUnitOperation, (actor, input) =>
  withDomainErrors(() => createUnit({ workspaceId: actor.workspace.id, ...input }), unitErrors)
);

export const updateUnitImplementation = implementOperation(
  updateUnitOperation,
  (actor, { unitId, ...changes }) =>
    withDomainErrors(async () => {
      const current = await prisma.unit.findFirst({
        where: { id: unitId, workspaceId: actor.workspace.id },
        select: { name: true, symbol: true, allowsFraction: true }
      });

      if (!current) {
        throw new Error("unit-not-found");
      }

      return updateUnit({
        workspaceId: actor.workspace.id,
        unitId,
        name: changes.name ?? current.name,
        symbol: changes.symbol ?? current.symbol,
        allowsFraction: changes.allowsFraction ?? current.allowsFraction
      });
    }, unitErrors)
);

export const deleteUnitImplementation = implementOperation(
  deleteUnitOperation,
  (actor, { unitId }) =>
    withDomainErrors(async () => {
      await deleteUnit({ workspaceId: actor.workspace.id, unitId });
      return { id: unitId };
    }, unitErrors)
);

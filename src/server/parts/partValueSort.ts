import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getEffectivePartCategoryAttributes } from "@/server/parts/attributes";

// Recomputes a part's value sort number inside the caller's transaction. An internal helper of
// part creation and attribute mutations, which have already authorized the actor; kept out of the
// "use server" module `createPart.ts`, where every exported async function is also a server action
// the browser can call (#295).
export async function updatePartValueSortNumber({
  tx,
  workspaceId,
  partId,
  primaryCategoryId,
}: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  partId: string;
  primaryCategoryId: string | null;
}) {
  if (!primaryCategoryId) {
    await tx.part.update({ where: { id: partId }, data: { valueSortNumber: null } });
    return;
  }

  const effectiveAttrs = await getEffectivePartCategoryAttributes({
    workspaceId,
    categoryId: primaryCategoryId
  });
  const valueAttr = effectiveAttrs.find((a) => a.isValue);

  if (!valueAttr) {
    await tx.part.update({ where: { id: partId }, data: { valueSortNumber: null } });
    return;
  }

  const attrValue = await tx.partAttributeValue.findUnique({
    where: { partId_attributeId: { partId, attributeId: valueAttr.attribute.id } },
    select: { quantityBaseValue: true, numberValue: true }
  });

  await tx.part.update({
    where: { id: partId },
    data: { valueSortNumber: attrValue?.quantityBaseValue ?? attrValue?.numberValue ?? null }
  });
}

import "server-only";

import { prisma } from "@/server/db/prisma";

export async function wipeDomainData(workspaceId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Items that RESTRICT deletion of Part and Organization
    await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { workspaceId } } });
    await tx.shoppingListItem.deleteMany({ where: { shoppingList: { workspaceId } } });
    // PurchaseOrder RESTRICT-references Organization (supplier)
    await tx.purchaseOrder.deleteMany({ where: { workspaceId } });
    await tx.shoppingList.deleteMany({ where: { workspaceId } });

    // InventoryEntry RESTRICT-references StorageLocation
    await tx.inventoryEntry.deleteMany({ where: { workspaceId } });

    // Attribute/AttributeChoiceOption are RESTRICT-referenced by these tables
    await tx.partAttributeValue.deleteMany({ where: { workspaceId } });
    await tx.workspaceAttribute.deleteMany({ where: { workspaceId } });
    await tx.categoryAttribute.deleteMany({ where: { workspaceId } });

    // Part RESTRICT-references Unit and Organization
    await tx.part.deleteMany({ where: { workspaceId } });

    // PartCategoryClosure must go before PartCategory (cascade ancestor/descendant)
    await tx.partCategoryClosure.deleteMany({ where: { workspaceId } });

    // Null out self-referential parentId to avoid RESTRICT on hierarchical delete,
    // then delete all categories and locations in one shot.
    await tx.partCategory.updateMany({ where: { workspaceId }, data: { parentId: null, valueAttributeId: null } });
    await tx.partCategory.deleteMany({ where: { workspaceId } });

    await tx.storageLocation.updateMany({ where: { workspaceId }, data: { parentId: null } });
    await tx.storageLocation.deleteMany({ where: { workspaceId } });

    // Attribute cascades to AttributeChoiceOption
    await tx.attribute.deleteMany({ where: { workspaceId } });

    // Unit and Organization are now free of RESTRICT references
    await tx.unit.deleteMany({ where: { workspaceId } });
    // Organization cascades to OrganizationRole and SupplierManufacturerMappingStat
    await tx.organization.deleteMany({ where: { workspaceId } });
  });
}

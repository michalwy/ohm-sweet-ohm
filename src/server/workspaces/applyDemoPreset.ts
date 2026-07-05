import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";

import { ensureInternalOrganizationForWorkspace } from "@/server/organizations/organizations";
import { parseDesignatorRange } from "@/lib/designators";
import { parseAttributeValue, type ParsedAttributeValue } from "@/server/parts/attributeValues";

import type {
  CategoryFixture,
  DemoPresetFixture,
  LocationFixture
} from "./demoPresetFixture";

export type DemoPreset = "empty" | "parts-only" | "parts-and-orders";

export type ApplyDemoPresetResult = {
  attributesCreated: number;
  categoriesCreated: number;
  manufacturersCreated: number;
  locationsCreated: number;
  partsCreated: number;
  inventoryEntriesCreated: number;
  shoppingListsCreated: number;
  purchaseOrdersCreated: number;
  designsCreated: number;
};

function normalize(name: string): string {
  return name.toLowerCase().trim();
}

export async function applyDemoPreset(
  prisma: PrismaClient,
  workspaceId: string,
  unitId: string,
  preset: DemoPreset,
  fixture: DemoPresetFixture,
  primaryCurrency?: string
): Promise<ApplyDemoPresetResult> {
  if (preset === "empty") {
    return {
      attributesCreated: 0,
      categoriesCreated: 0,
      manufacturersCreated: 0,
      locationsCreated: 0,
      partsCreated: 0,
      inventoryEntriesCreated: 0,
      shoppingListsCreated: 0,
      purchaseOrdersCreated: 0,
      designsCreated: 0
    };
  }

  const result: ApplyDemoPresetResult = {
    attributesCreated: 0,
    categoriesCreated: 0,
    manufacturersCreated: 0,
    locationsCreated: 0,
    partsCreated: 0,
    inventoryEntriesCreated: 0,
    shoppingListsCreated: 0,
    purchaseOrdersCreated: 0,
    designsCreated: 0
  };

  // ── Step 1: Attributes ─────────────────────────────────────────────────────
  const attributeIdByKey = new Map<string, string>();
  const choiceOptionIdByKey = new Map<string, string>();
  const attributeFixtureByKey = new Map(fixture.attributes.map((attr) => [attr.key, attr]));

  for (const attr of fixture.attributes) {
    const normalizedName = normalize(attr.name);
    const record = await prisma.attribute.upsert({
      where: { workspaceId_normalizedName: { workspaceId, normalizedName } },
      update: { name: attr.name, type: attr.type, baseUnitSymbol: attr.baseUnitSymbol ?? null },
      create: {
        workspaceId,
        name: attr.name,
        normalizedName,
        type: attr.type,
        baseUnitSymbol: attr.baseUnitSymbol ?? null
      },
      select: { id: true }
    });
    attributeIdByKey.set(attr.key, record.id);
    result.attributesCreated++;

    if (attr.choices) {
      for (const choice of attr.choices) {
        const normalizedLabel = normalize(choice.label);
        const optionRecord = await prisma.attributeChoiceOption.upsert({
          where: { attributeId_normalizedLabel: { attributeId: record.id, normalizedLabel } },
          update: { label: choice.label, sortOrder: choice.sortOrder },
          create: {
            attributeId: record.id,
            label: choice.label,
            normalizedLabel,
            sortOrder: choice.sortOrder
          },
          select: { id: true }
        });
        choiceOptionIdByKey.set(choice.key, optionRecord.id);
      }
    }
  }

  // ── Step 2: Categories ─────────────────────────────────────────────────────
  const categoryIdByKey = new Map<string, string>();

  // Topological sort: roots first, then children in dependency order
  function sortCategories(cats: CategoryFixture[]): CategoryFixture[] {
    const sorted: CategoryFixture[] = [];
    const sortedKeys = new Set<string>();
    const remaining = [...cats];
    const maxPasses = cats.length + 1;
    let passes = 0;
    while (remaining.length > 0 && passes < maxPasses) {
      passes++;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const cat = remaining[i]!;
        if (!cat.parentKey || sortedKeys.has(cat.parentKey)) {
          sorted.push(cat);
          sortedKeys.add(cat.key);
          remaining.splice(i, 1);
        }
      }
    }
    return sorted;
  }

  const sortedCategories = sortCategories(fixture.categories);

  for (const cat of sortedCategories) {
    const parentId = cat.parentKey ? (categoryIdByKey.get(cat.parentKey) ?? null) : null;

    let existing = await prisma.partCategory.findFirst({
      where: { workspaceId, name: cat.name, parentId },
      select: { id: true }
    });

    if (!existing) {
      existing = await prisma.partCategory.create({
        data: { workspaceId, name: cat.name, isAssignable: cat.isAssignable, parentId },
        select: { id: true }
      });
      result.categoriesCreated++;

      // Self-closure
      await prisma.partCategoryClosure.create({
        data: { workspaceId, ancestorId: existing.id, descendantId: existing.id, depth: 0 }
      });

      // Ancestor closures
      if (parentId) {
        const parentClosures = await prisma.partCategoryClosure.findMany({
          where: { workspaceId, descendantId: parentId },
          select: { ancestorId: true, depth: true }
        });
        if (parentClosures.length > 0) {
          await prisma.partCategoryClosure.createMany({
            data: parentClosures.map((c) => ({
              workspaceId,
              ancestorId: c.ancestorId,
              descendantId: existing!.id,
              depth: c.depth + 1
            }))
          });
        }
      }
    }

    categoryIdByKey.set(cat.key, existing.id);

    // Set valueAttributeId after the category exists
    if (cat.valueAttributeKey) {
      const valueAttrId = attributeIdByKey.get(cat.valueAttributeKey);
      if (valueAttrId) {
        await prisma.partCategory.update({
          where: { id: existing.id },
          data: { valueAttributeId: valueAttrId }
        });
      }
    }

    // Category attribute attachments
    if (cat.attributes) {
      for (const catAttr of cat.attributes) {
        const attrId = attributeIdByKey.get(catAttr.attributeKey);
        if (!attrId) continue;
        const defaultChoiceOptionId = catAttr.defaultChoiceOptionKey
          ? (choiceOptionIdByKey.get(catAttr.defaultChoiceOptionKey) ?? null)
          : null;
        await prisma.categoryAttribute.upsert({
          where: { categoryId_attributeId: { categoryId: existing.id, attributeId: attrId } },
          update: {
            sortOrder: catAttr.sortOrder,
            isPrimary: catAttr.isPrimary ?? false,
            defaultQuantityBaseValue: catAttr.defaultQuantityBaseValue ?? null,
            defaultChoiceOptionId
          },
          create: {
            workspaceId,
            categoryId: existing.id,
            attributeId: attrId,
            sortOrder: catAttr.sortOrder,
            isPrimary: catAttr.isPrimary ?? false,
            defaultQuantityBaseValue: catAttr.defaultQuantityBaseValue ?? null,
            defaultChoiceOptionId
          }
        });
      }
    }
  }

  // ── Step 3: Organizations (manufacturers + suppliers) ─────────────────────
  const organizationIdByKey = new Map<string, string>();

  const allOrgs = [
    ...fixture.manufacturers.map((m) => ({ ...m, role: "manufacturer" as const })),
    ...fixture.suppliers.map((s) => ({ ...s, role: "supplier" as const }))
  ];

  for (const org of allOrgs) {
    const normalizedName = normalize(org.name);
    const record = await prisma.organization.upsert({
      where: { workspaceId_normalizedName: { workspaceId, normalizedName } },
      update: {},
      create: { workspaceId, name: org.name, normalizedName },
      select: { id: true }
    });
    await prisma.organizationRole.upsert({
      where: { organizationId_role: { organizationId: record.id, role: org.role } },
      update: {},
      create: { organizationId: record.id, role: org.role }
    });
    if (!organizationIdByKey.has(org.key)) {
      organizationIdByKey.set(org.key, record.id);
      result.manufacturersCreated++;
    }
  }

  // ── Step 4: Storage locations ─────────────────────────────────────────────
  const locationIdByKey = new Map<string, string>();

  function sortLocations(locs: LocationFixture[]): LocationFixture[] {
    const sorted: LocationFixture[] = [];
    const sortedKeys = new Set<string>();
    const remaining = [...locs];
    const maxPasses = locs.length + 1;
    let passes = 0;
    while (remaining.length > 0 && passes < maxPasses) {
      passes++;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const loc = remaining[i]!;
        if (!loc.parentKey || sortedKeys.has(loc.parentKey)) {
          sorted.push(loc);
          sortedKeys.add(loc.key);
          remaining.splice(i, 1);
        }
      }
    }
    return sorted;
  }

  const sortedLocations = sortLocations(fixture.locations);

  for (const loc of sortedLocations) {
    const parentId = loc.parentKey ? (locationIdByKey.get(loc.parentKey) ?? null) : null;
    const normalizedName = normalize(loc.name);

    // StorageLocation unique index includes parentId; null parentId requires findFirst + upsert fallback
    let existing = await prisma.storageLocation.findFirst({
      where: { workspaceId, parentId, normalizedName },
      select: { id: true }
    });
    if (!existing) {
      existing = await prisma.storageLocation.create({
        data: { workspaceId, name: loc.name, normalizedName, parentId, isAssignable: loc.isAssignable },
        select: { id: true }
      });
    }
    locationIdByKey.set(loc.key, existing.id);
    result.locationsCreated++;
  }

  // ── Step 5: Parts ─────────────────────────────────────────────────────────
  const partIdByRef = new Map<string, string>();

  for (const part of fixture.parts) {
    const manufacturerId = organizationIdByKey.get(part.manufacturerKey);
    if (!manufacturerId) continue;
    const primaryCategoryId = part.primaryCategoryKey
      ? (categoryIdByKey.get(part.primaryCategoryKey) ?? null)
      : null;

    const record = await prisma.part.upsert({
      where: {
        workspaceId_manufacturerId_catalogNumber: {
          workspaceId,
          manufacturerId,
          catalogNumber: part.catalogNumber
        }
      },
      update: { primaryCategoryId },
      create: {
        workspaceId,
        unitId,
        manufacturerId,
        catalogNumber: part.catalogNumber,
        primaryCategoryId
      },
      select: { id: true }
    });
    partIdByRef.set(`${part.manufacturerKey}::${part.catalogNumber}`, record.id);
    result.partsCreated++;

    // ── Step 6: Part attribute values ────────────────────────────────────────
    if (part.attributes) {
      for (const pav of part.attributes) {
        const attrId = attributeIdByKey.get(pav.attributeKey);
        if (!attrId) continue;
        const choiceOptionId = pav.choiceOptionKey
          ? (choiceOptionIdByKey.get(pav.choiceOptionKey) ?? null)
          : null;
        await prisma.partAttributeValue.upsert({
          where: { partId_attributeId: { partId: record.id, attributeId: attrId } },
          update: {
            quantityBaseValue: pav.quantityBaseValue ?? null,
            textValue: pav.textValue ?? null,
            numberValue: pav.numberValue ?? null,
            booleanValue: pav.booleanValue ?? null,
            choiceOptionId,
            displayValue: pav.displayValue ?? null
          },
          create: {
            workspaceId,
            partId: record.id,
            attributeId: attrId,
            quantityBaseValue: pav.quantityBaseValue ?? null,
            textValue: pav.textValue ?? null,
            numberValue: pav.numberValue ?? null,
            booleanValue: pav.booleanValue ?? null,
            choiceOptionId,
            displayValue: pav.displayValue ?? null
          }
        });
      }
    }
  }

  // ── Step 7: Inventory entries + stock ─────────────────────────────────────
  for (const part of fixture.parts) {
    if (!part.stockEntries || part.stockEntries.length === 0) continue;

    const partId = partIdByRef.get(`${part.manufacturerKey}::${part.catalogNumber}`);
    if (!partId) continue;

    // Idempotency: skip if this part already has inventory entries
    const entryCount = await prisma.inventoryEntry.count({ where: { workspaceId, partId } });
    if (entryCount > 0) continue;

    for (const se of part.stockEntries) {
      const locationId = locationIdByKey.get(se.locationKey);
      if (!locationId) continue;

      await prisma.inventoryEntry.create({
        data: {
          workspaceId,
          partId,
          entryType: "RECEIPT",
          quantity: se.quantity,
          toLocationId: locationId
        }
      });

      await prisma.part.update({
        where: { id: partId },
        data: { currentStock: { increment: se.quantity } }
      });

      result.inventoryEntriesCreated++;
    }
  }

  // ── Steps 8–9: Shopping lists + Purchase orders (parts-and-orders only) ───
  if (preset === "parts-and-orders") {
    // Shopping lists
    for (const sl of fixture.shoppingLists) {
      const existing = await prisma.shoppingList.findFirst({
        where: { workspaceId, name: sl.name },
        select: { id: true }
      });
      if (existing) continue;

      const created = await prisma.shoppingList.create({
        data: { workspaceId, name: sl.name, description: sl.description ?? null },
        select: { id: true }
      });
      result.shoppingListsCreated++;

      for (const item of sl.items) {
        const partId = partIdByRef.get(`${item.manufacturerKey}::${item.catalogNumber}`);
        if (!partId) continue;
        await prisma.shoppingListItem.create({
          data: { shoppingListId: created.id, partId, quantity: item.quantity }
        });
      }
    }

    // Purchase orders
    for (const po of fixture.purchaseOrders) {
      const supplierId = organizationIdByKey.get(po.supplierKey);
      if (!supplierId) continue;

      // Idempotency: skip if an order with this order number already exists
      if (po.orderNumber) {
        const existing = await prisma.purchaseOrder.findFirst({
          where: { workspaceId, orderNumber: po.orderNumber },
          select: { id: true }
        });
        if (existing) continue;
      }

      const createdPo = await prisma.purchaseOrder.create({
        data: {
          workspaceId,
          supplierId,
          status: po.status,
          orderNumber: po.orderNumber ?? null,
          currency: primaryCurrency ?? po.currency ?? null,
          notes: po.notes ?? null,
          orderedAt: po.status === "ORDERED" || po.status === "RECEIVED" ? new Date() : null
        },
        select: { id: true }
      });
      result.purchaseOrdersCreated++;

      let poTotalNet = new Prisma.Decimal(0);
      let poTotalGross = new Prisma.Decimal(0);

      for (const item of po.items) {
        const partId = partIdByRef.get(`${item.manufacturerKey}::${item.catalogNumber}`);
        if (!partId) continue;

        const receivedQty = po.status === "RECEIVED" ? item.quantity : 0;

        // Compute line values: no tax in demo preset, currency == primaryCurrency so rate = 1
        let lineNetValue: Prisma.Decimal | null = null;
        let lineGrossValue: Prisma.Decimal | null = null;
        let lineNetValuePrimary: Prisma.Decimal | null = null;
        let lineGrossValuePrimary: Prisma.Decimal | null = null;

        if (item.unitPrice != null) {
          lineNetValue = new Prisma.Decimal(item.unitPrice).mul(item.quantity).toDecimalPlaces(2);
          lineGrossValue = lineNetValue; // taxRate = 0
          lineNetValuePrimary = lineNetValue;
          lineGrossValuePrimary = lineNetValue;
          poTotalNet = poTotalNet.plus(lineNetValue);
          poTotalGross = poTotalGross.plus(lineGrossValue);
        }

        await prisma.purchaseOrderItem.create({
          data: {
            purchaseOrderId: createdPo.id,
            partId,
            quantity: item.quantity,
            receivedQuantity: receivedQty,
            unitPrice: item.unitPrice ?? null,
            lineNetValue,
            lineGrossValue,
            lineNetValuePrimary,
            lineGrossValuePrimary
          }
        });

        // Mirror the plannedQty/onOrderQty side effects that createPurchaseOrderItem/markOrdered
        // apply on the normal creation path, since the fixture bulk-inserts items directly.
        if (po.status === "DRAFT") {
          await prisma.part.update({
            where: { id: partId },
            data: { plannedQty: { increment: item.quantity } }
          });
        } else if (po.status === "ORDERED") {
          await prisma.part.update({
            where: { id: partId },
            data: { onOrderQty: { increment: item.quantity } }
          });
        }

        // For received POs, create inventory entries and update stock + avg cost
        if (po.status === "RECEIVED" && item.locationKey) {
          const locationId = locationIdByKey.get(item.locationKey);
          if (locationId) {
            const unitCostPrimary = item.unitPrice != null
              ? new Prisma.Decimal(item.unitPrice)
              : null;

            const entryCount = await prisma.inventoryEntry.count({
              where: { workspaceId, partId }
            });
            if (entryCount === 0) {
              await prisma.inventoryEntry.create({
                data: {
                  workspaceId,
                  partId,
                  entryType: "RECEIPT",
                  quantity: item.quantity,
                  toLocationId: locationId,
                  unitCost: unitCostPrimary,
                  costCurrency: primaryCurrency ?? null,
                  unitCostPrimary,
                  unitGrossCostPrimary: unitCostPrimary
                }
              });
              await prisma.part.update({
                where: { id: partId },
                data: {
                  currentStock: { increment: item.quantity },
                  ...(unitCostPrimary != null && {
                    avgNetCostPrimary: unitCostPrimary,
                    avgGrossCostPrimary: unitCostPrimary
                  })
                }
              });
              result.inventoryEntriesCreated++;
            } else if (unitCostPrimary != null) {
              // Entry already created by stockEntries loop (no cost); set avg cost if missing
              await prisma.part.updateMany({
                where: { id: partId, avgNetCostPrimary: null },
                data: {
                  avgNetCostPrimary: unitCostPrimary,
                  avgGrossCostPrimary: unitCostPrimary
                }
              });
            }
          }
        }
      }

      // Update PO totals (primaryCurrency == orderCurrency so primary values equal order values)
      if (poTotalNet.greaterThan(0)) {
        await prisma.purchaseOrder.update({
          where: { id: createdPo.id },
          data: {
            totalNetValue: poTotalNet,
            totalGrossValue: poTotalGross,
            totalNetValuePrimary: poTotalNet,
            totalGrossValuePrimary: poTotalGross
          }
        });
      }
    }
  }

  // ── Step 10: Designs (in-house assemblies) ────────────────────────────────
  if (fixture.designs.length > 0) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true }
    });
    const internalOrg = await ensureInternalOrganizationForWorkspace({
      workspaceId,
      workspaceName: workspace?.name ?? "Internal"
    });

    for (const design of fixture.designs) {
      // Idempotency: skip if the output part already backs a design
      const existingPart = await prisma.part.findUnique({
        where: {
          workspaceId_manufacturerId_catalogNumber: {
            workspaceId,
            manufacturerId: internalOrg.id,
            catalogNumber: design.outputCatalogNumber
          }
        },
        select: { id: true, assembledByDesign: { select: { id: true } } }
      });
      if (existingPart?.assembledByDesign) continue;

      const outputPartId =
        existingPart?.id ??
        (
          await prisma.part.create({
            data: {
              workspaceId,
              unitId,
              manufacturerId: internalOrg.id,
              catalogNumber: design.outputCatalogNumber,
              description: design.description ?? design.name
            },
            select: { id: true }
          })
        ).id;

      const revisions = [
        { workspaceId, revisionNumber: 1, notes: null as string | null },
        ...(design.extraRevisions ?? []).map((rev, i) => ({
          workspaceId,
          revisionNumber: i + 2,
          notes: rev.notes ?? null
        }))
      ];

      const createdDesign = await prisma.design.create({
        data: {
          workspaceId,
          name: design.name,
          description: design.description ?? null,
          outputPartId,
          revisions: { create: revisions }
        },
        select: {
          revisions: {
            orderBy: { revisionNumber: "desc" },
            take: 1,
            select: { id: true }
          }
        }
      });
      result.designsCreated++;

      // BOM line items on the latest revision
      const latestRevisionId = createdDesign.revisions[0]?.id;
      if (latestRevisionId && design.bomLineItems?.length) {
        let sortOrder = 0;
        for (const lineItem of design.bomLineItems) {
          const { quantity } = parseDesignatorRange(lineItem.designators);
          const categoryId = lineItem.categoryKey
            ? (categoryIdByKey.get(lineItem.categoryKey) ?? null)
            : null;
          const pinnedPartId = lineItem.pinnedPart
            ? (partIdByRef.get(
                `${lineItem.pinnedPart.manufacturerKey}::${lineItem.pinnedPart.catalogNumber}`
              ) ?? null)
            : null;

          const matcherData = (lineItem.matchers ?? [])
            .map((matcher) => {
              const attributeFixture = attributeFixtureByKey.get(matcher.attributeKey);
              const attributeId = attributeIdByKey.get(matcher.attributeKey);
              if (!attributeFixture || !attributeId) return null;
              const choiceOptions = (attributeFixture.choices ?? []).map((choice) => ({
                id: choiceOptionIdByKey.get(choice.key) ?? choice.key,
                label: choice.label
              }));
              const parsed = parseAttributeValue({
                type: attributeFixture.type,
                rawValue: matcher.value,
                baseUnitSymbol: attributeFixture.baseUnitSymbol,
                choiceOptions
              });
              return {
                workspaceId,
                attributeId,
                operator: matcher.operator,
                ...bomMatcherValueFields(parsed)
              };
            })
            .filter((value): value is NonNullable<typeof value> => value !== null);

          await prisma.bomLineItem.create({
            data: {
              workspaceId,
              revisionId: latestRevisionId,
              categoryId,
              pinnedPartId,
              designators: lineItem.designators,
              quantity,
              sortOrder: sortOrder++,
              notes: lineItem.notes ?? null,
              matchers: { create: matcherData }
            }
          });
        }
      }
    }
  }

  return result;
}

function bomMatcherValueFields(parsed: ParsedAttributeValue) {
  switch (parsed.type) {
    case "TEXT":
      return { textValue: parsed.textValue, displayValue: parsed.displayValue };
    case "NUMBER":
      return { numberValue: parsed.numberValue, displayValue: parsed.displayValue };
    case "QUANTITY":
      return { quantityBaseValue: parsed.quantityBaseValue, displayValue: parsed.displayValue };
    case "BOOLEAN":
      return { booleanValue: parsed.booleanValue, displayValue: parsed.displayValue };
    case "CHOICE":
      return { choiceOptionId: parsed.choiceOptionId, displayValue: parsed.displayValue };
  }
}

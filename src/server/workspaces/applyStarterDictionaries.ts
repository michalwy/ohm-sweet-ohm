import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";

import { ensureStarterDictionaryUnitsForWorkspace } from "@/server/units/defaultUnits";

import { applyDictionaryFixture } from "./applyDemoPreset";
import { DEMO_PRESET_FIXTURE } from "./demoPresetFixture";

export type ApplyStarterDictionariesResult = {
  attributesCreated: number;
  categoriesCreated: number;
  organizationsCreated: number;
  unitsCreated: number;
};

/**
 * Seeds only the dictionary layer (attributes, categories, manufacturers/suppliers,
 * extra stock units) with no parts, locations, or stock. Shares the same fixture as
 * the demo-data presets and is additive/idempotent, so it can be applied to any
 * workspace at any time, not just at creation.
 */
export async function applyStarterDictionaries(
  prisma: PrismaClient,
  workspaceId: string
): Promise<ApplyStarterDictionariesResult> {
  const { attributesCreated, categoriesCreated, organizationsCreated } = await applyDictionaryFixture(
    prisma,
    workspaceId,
    DEMO_PRESET_FIXTURE
  );

  const unitsCreated = await ensureStarterDictionaryUnitsForWorkspace(prisma, workspaceId);

  return {
    attributesCreated,
    categoriesCreated,
    organizationsCreated,
    unitsCreated
  };
}

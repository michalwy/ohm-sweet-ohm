import "server-only";

import { digiKeyPartSearchProvider } from "@/server/integrations/digikey";
import { tmePartSearchProvider } from "@/server/integrations/tme";
import type {
  SupplierPartSearchProvider,
  SupplierProviderKey
} from "@/server/integrations/types";

const providersByKey: Partial<Record<SupplierProviderKey, SupplierPartSearchProvider>> = {
  digikey: digiKeyPartSearchProvider,
  tme: tmePartSearchProvider
};

export function getSupplierPartSearchProvider(key: SupplierProviderKey) {
  return providersByKey[key] ?? null;
}

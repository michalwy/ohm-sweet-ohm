import { restOperation } from "@/server/api/rest";
import { getSupplierPartAttributesImplementation } from "@/server/integrations/supplierApi";

export const GET = restOperation(getSupplierPartAttributesImplementation);

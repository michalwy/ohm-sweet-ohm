import { restOperation } from "@/server/api/rest";
import { searchSupplierPartsImplementation } from "@/server/integrations/supplierApi";

export const GET = restOperation(searchSupplierPartsImplementation);

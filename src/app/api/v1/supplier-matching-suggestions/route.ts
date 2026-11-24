import { restOperation } from "@/server/api/rest";
import { getSupplierMatchingSuggestionsImplementation } from "@/server/integrations/supplierApi";

export const POST = restOperation(getSupplierMatchingSuggestionsImplementation);

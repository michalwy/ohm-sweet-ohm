import { restOperation } from "@/server/api/rest";
import {
  createOrganizationImplementation,
  listOrganizationsImplementation
} from "@/server/organizations/organizationApi";

export const GET = restOperation(listOrganizationsImplementation);
export const POST = restOperation(createOrganizationImplementation);

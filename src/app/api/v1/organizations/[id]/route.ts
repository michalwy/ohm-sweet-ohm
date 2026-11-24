import { restOperation } from "@/server/api/rest";
import {
  deleteOrganizationImplementation,
  getOrganizationImplementation,
  updateOrganizationImplementation
} from "@/server/organizations/organizationApi";

export const GET = restOperation(getOrganizationImplementation);
export const PATCH = restOperation(updateOrganizationImplementation);
export const DELETE = restOperation(deleteOrganizationImplementation);

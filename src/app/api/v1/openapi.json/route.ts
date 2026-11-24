import { buildOpenApiDocument } from "@/server/api/openapi";
import { restEndpoints } from "@/server/api/restEndpoints";

/**
 * The OpenAPI 3.1 document of `/api/v1` (#274). Public: it describes the API, not a workspace, and
 * carries no data.
 */
export function GET() {
  return Response.json(buildOpenApiDocument(restEndpoints));
}

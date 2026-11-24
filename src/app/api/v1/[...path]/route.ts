import { endpointNotFoundResponse } from "@/server/api/rest";

/** Any other path under `/api/v1` answers the API's JSON 404, not the app's HTML page. */
function notFound() {
  return endpointNotFoundResponse();
}

export { notFound as DELETE, notFound as GET, notFound as PATCH, notFound as POST, notFound as PUT };

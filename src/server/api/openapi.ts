import { z } from "zod";

import { getOperationJsonSchemas } from "@/server/api/operations";
import { REST_API_BASE_PATH, type RestEndpoint } from "@/server/api/restEndpoints";

type JsonObject = Record<string, unknown>;

export const OPENAPI_VERSION = "3.1.0";

const errorSchema = z.object({
  error: z
    .object({
      code: z
        .string()
        .describe(
          "Stable kebab-case error code, e.g. invalid-input, unauthorized, permission-denied, part-not-found."
        ),
      message: z.string().describe("A human-readable explanation; do not parse it."),
      issues: z
        .array(
          z.object({
            path: z.string().describe("Dot-separated path of the field in the input; empty for the input itself."),
            code: z.string().describe("The validation rule that failed."),
            message: z.string().describe("What is wrong with the field.")
          })
        )
        .optional()
        .describe("Present for invalid-input: one entry per invalid field.")
    })
    .describe("The error.")
});

const errorResponses: Record<string, { description: string; when: (endpoint: RestEndpoint) => boolean }> = {
  "400": { description: "The input is invalid (`invalid-input`, with `issues`) or not acceptable.", when: () => true },
  "401": { description: "The bearer token is missing, malformed, unknown, revoked or expired.", when: () => true },
  "403": {
    description: "The token does not grant the permission this endpoint needs (`permission-denied`).",
    when: (endpoint) => endpoint.operation.permission !== null
  },
  "404": { description: "Nothing with that id exists in the token's workspace.", when: () => true },
  "409": { description: "The current state of the workspace forbids the operation.", when: (endpoint) => endpoint.method !== "get" }
};

/**
 * The OpenAPI 3.1 document of `/api/v1` (#274), generated from the operations' zod schemas. Pure,
 * so a unit test validates it; `GET /api/v1/openapi.json` serves it.
 */
export function buildOpenApiDocument(
  endpoints: readonly RestEndpoint[]
): JsonObject {
  const paths: Record<string, Record<string, JsonObject>> = {};

  for (const endpoint of endpoints) {
    paths[endpoint.path] ??= {};
    paths[endpoint.path][endpoint.method] = describeEndpoint(endpoint);
  }

  return {
    openapi: OPENAPI_VERSION,
    info: {
      title: "OhmSweetOhm API",
      // The API's major version, as in its path; additive changes keep it (ADR 0030).
      version: "1",
      description:
        "The REST API of an OhmSweetOhm workspace. Every request carries a personal API token as `Authorization: Bearer <token>`; the token is bound to one workspace, and every call acts there as the token's user, with the token's permissions intersected with the user's roles. List endpoints page with `cursor` and `pageSize`: pass the previous page's `nextCursor` as `cursor` until it is null."
    },
    servers: [{ url: REST_API_BASE_PATH }],
    security: [{ bearerAuth: [] }],
    tags: [...new Set(endpoints.map((endpoint) => endpoint.tag))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "A personal API token, created at Settings → API tokens."
        }
      },
      schemas: { Error: toSchema(z.toJSONSchema(errorSchema, { target: "draft-2020-12" })) }
    }
  };
}

function describeEndpoint(endpoint: RestEndpoint): JsonObject {
  const { operation } = endpoint;
  const schemas = getOperationJsonSchemas(operation);
  const input = toSchema(schemas.input);
  const responses: Record<string, JsonObject> = {
    "200": {
      description: "Success.",
      content: { "application/json": { schema: toSchema(schemas.output) } }
    }
  };

  for (const [status, response] of Object.entries(errorResponses)) {
    if (response.when(endpoint)) {
      responses[status] = {
        description: response.description,
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
      };
    }
  }

  const description = operation.permission
    ? `${operation.description}\n\nRequires the \`${operation.permission}\` permission.`
    : operation.description;

  const described: JsonObject = {
    operationId: operation.name,
    summary: endpoint.summary,
    description,
    tags: [endpoint.tag],
    responses
  };

  const pathNames = getPathParameterNames(endpoint.path);
  const { pathInput, otherInput } = splitPathInput(input, pathNames);
  const parameters = describeParameters(pathInput, "path");

  if (endpoint.method === "get") {
    parameters.push(...describeParameters(otherInput, "query"));
  } else if (Object.keys((otherInput.properties ?? {}) as JsonObject).length > 0) {
    described.requestBody = {
      required: true,
      content: { "application/json": { schema: otherInput } }
    };
  }

  if (parameters.length > 0) {
    described.parameters = parameters;
  }

  return described;
}

/** The `{param}` placeholders of an endpoint path, e.g. `["id"]` for `/organizations/{id}`. */
export function getPathParameterNames(path: string) {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
}

/**
 * An operation's input schema split in two: the fields its path carries (`{id}`) and the rest,
 * which is the query string of a `get` and the JSON body of any other method (#279).
 */
function splitPathInput(input: JsonObject, pathNames: string[]) {
  const properties = (input.properties ?? {}) as Record<string, JsonObject>;
  const required = (input.required ?? []) as string[];
  const pick = (keep: (name: string) => boolean): JsonObject => {
    const picked: JsonObject = {
      ...input,
      properties: Object.fromEntries(Object.entries(properties).filter(([name]) => keep(name)))
    };
    const pickedRequired = required.filter(keep);

    if (pickedRequired.length > 0) {
      picked.required = pickedRequired;
    } else {
      delete picked.required;
    }

    return picked;
  };

  return {
    pathInput: pick((name) => pathNames.includes(name)),
    otherInput: pick((name) => !pathNames.includes(name))
  };
}

function describeParameters(input: JsonObject, location: "path" | "query"): JsonObject[] {
  const properties = (input.properties ?? {}) as Record<string, JsonObject>;
  const required = new Set((input.required ?? []) as string[]);

  return Object.entries(properties).map(([name, schema]) => {
    const { description, ...rest } = schema;
    const parameter: JsonObject = {
      name,
      in: location,
      required: location === "path" || required.has(name),
      schema: rest
    };

    if (typeof description === "string") {
      parameter.description = description;
    }

    if (location === "query" && rest.type === "array") {
      parameter.style = "form";
      parameter.explode = true;
    }

    return parameter;
  });
}

/** A generated JSON Schema embedded in the document: its `$schema` is the document's dialect already. */
function toSchema(schema: z.core.JSONSchema.BaseSchema): JsonObject {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, ...rest } = schema as JsonObject;
  return rest;
}

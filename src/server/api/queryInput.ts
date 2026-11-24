import type { z } from "zod";

type JsonSchemaNode = {
  type?: string | string[];
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  properties?: Record<string, JsonSchemaNode>;
};

/**
 * A GET endpoint's input from its query string (#274). Pure, so unit tests can load it.
 *
 * Query values are strings; the operation's input schema says what each parameter is, so a value
 * is converted only where the schema's JSON Schema allows a number, integer or boolean, and a
 * parameter typed as an array collects every repeated value (`?id=a&id=b`). Anything else stays a
 * string, and the schema then validates the result as it would a JSON body — a value that does not
 * convert (`pageSize=ten`) reaches it unchanged and fails with the usual `invalid-input` issue.
 */
export function readQueryInput(
  searchParams: URLSearchParams,
  inputJsonSchema: z.core.JSONSchema.BaseSchema
): Record<string, unknown> {
  const properties = (inputJsonSchema as JsonSchemaNode).properties ?? {};
  const input: Record<string, unknown> = {};

  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    const types = collectTypes(properties[key]);

    input[key] = types.has("array")
      ? values
      : convertScalar(values[values.length - 1], types);
  }

  return input;
}

function collectTypes(schema: JsonSchemaNode | undefined, types = new Set<string>()) {
  if (!schema) {
    return types;
  }

  if (typeof schema.type === "string") {
    types.add(schema.type);
  } else if (Array.isArray(schema.type)) {
    schema.type.forEach((type) => types.add(type));
  }

  for (const branch of [...(schema.anyOf ?? []), ...(schema.oneOf ?? [])]) {
    collectTypes(branch, types);
  }

  return types;
}

function convertScalar(value: string, types: Set<string>): unknown {
  if ((types.has("integer") || types.has("number")) && /^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  if (types.has("boolean") && (value === "true" || value === "false")) {
    return value === "true";
  }

  return value;
}

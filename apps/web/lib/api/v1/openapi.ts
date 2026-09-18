import type { ZodObject } from "zod/v4";

/**
 * Turns a live v1 query-param zod schema into an OpenAPI `parameters` array
 * by walking its actual `.shape` (name + description + required) rather
 * than hand-duplicating the field list. We don't run these through
 * `z.toJSONSchema()` — most v1 filter fields are `.transform(parseFilterValue)`
 * pipes (reused from lib/zod/schemas/analytics.ts) and zod v4's JSON Schema
 * converter refuses to represent a transform. Walking `.shape` for
 * description/optionality sidesteps that entirely, and still means this
 * list can never drift from the schema that actually validates the request.
 */
export function zodQueryToOpenApiParams(schema: ZodObject<any>) {
  return Object.entries(schema.shape).map(([name, field]: [string, any]) => ({
    name,
    in: "query",
    required: field.isOptional ? !field.isOptional() : false,
    description: field.description ?? undefined,
    schema: { type: "string" },
  }));
}

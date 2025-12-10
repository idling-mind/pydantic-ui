import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SchemaField } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the effective value for a field, using the schema default if the value is undefined/null.
 * This ensures that default values defined in Pydantic models are properly displayed in the UI.
 */
export function getValueWithDefault<T = unknown>(
  value: unknown,
  schema: SchemaField,
  fallback?: T
): T | unknown {
  // If value is defined and not null, use it
  if (value !== undefined && value !== null) {
    return value;
  }
  
  // If schema has a default value, use it
  if (schema.default !== undefined && schema.default !== null) {
    return schema.default;
  }
  
  // Return fallback if provided
  return fallback as T;
}

/**
 * Create a default value for a schema field based on its type and default value.
 * This is used when adding new items to arrays or creating new nested objects.
 */
export function createDefaultFromSchema(schema: SchemaField): unknown {
  // If schema has a default value, use it (deep clone for objects/arrays)
  if (schema.default !== undefined && schema.default !== null) {
    // Deep clone to avoid mutating the schema default
    return JSON.parse(JSON.stringify(schema.default));
  }
  
  // Create type-based default
  switch (schema.type) {
    case 'string':
      return '';
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      // For objects with defined fields, create defaults for each field
      if (schema.fields) {
        const obj: Record<string, unknown> = {};
        for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
          obj[fieldName] = createDefaultFromSchema(fieldSchema);
        }
        return obj;
      }
      return {};
    default:
      return null;
  }
}

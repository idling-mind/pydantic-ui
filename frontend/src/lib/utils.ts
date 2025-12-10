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
    case 'union':
      // For unions, return null - user must select a variant
      // The UnionInput component will handle variant selection
      return null;
    default:
      return null;
  }
}

/**
 * Evaluate a JavaScript visibility condition for conditional field rendering.
 * 
 * The condition is evaluated as JavaScript with access to:
 * - `data`: the full form data object
 * - `value`: the current field's value
 * 
 * Example conditions:
 * - "data.status === 'active'"
 * - "new Date(data.created) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)"
 * - "value !== null && value.length > 0"
 * 
 * @param condition - JavaScript expression that should return a boolean
 * @param data - The full form data object
 * @param value - The current field's value
 * @returns true if the field should be visible, false otherwise
 */
export function evaluateVisibility(
  condition: string | undefined | null,
  data: Record<string, unknown>,
  value?: unknown
): boolean {
  // If no condition is specified, the field is always visible
  if (!condition) {
    return true;
  }

  try {
    // Create a function that evaluates the condition
    // Using Function constructor to create a sandboxed evaluation context
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const evaluator = new Function('data', 'value', `return Boolean(${condition});`);
    const result = evaluator(data, value);
    return result === true;
  } catch (error) {
    // Log error in development but don't break the UI
    console.warn(`[pydantic-ui] Error evaluating visibility condition: "${condition}"`, error);
    // Default to visible if there's an error in the condition
    return true;
  }
}

/**
 * Check if a field should be visible based on its schema and data context.
 * Combines the static `hidden` property with dynamic `visible_when` evaluation.
 * 
 * @param schema - The field's schema
 * @param data - The full form data object
 * @param value - The current field's value
 * @returns true if the field should be visible
 */
export function isFieldVisible(
  schema: SchemaField,
  data: Record<string, unknown>,
  value?: unknown
): boolean {
  // If statically hidden, always hide
  if (schema.ui_config?.hidden) {
    return false;
  }

  // If there's a visible_when condition, evaluate it
  if (schema.ui_config?.visible_when) {
    return evaluateVisibility(schema.ui_config.visible_when, data, value);
  }

  // Default: visible
  return true;
}

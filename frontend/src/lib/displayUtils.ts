/**
 * Display resolution utilities.
 *
 * Provides a unified way to resolve display properties (title, subtitle, help_text)
 * for schema fields across all views. Supports template syntax for data-driven titles.
 *
 * Template Syntax:
 * - {field} → value of data.field
 * - {field.nested} → value of data.field.nested
 * - Static text mixed with templates: "User: {name}"
 * - Escape literal braces with double braces: "{{not a template}}"
 */

import { SchemaField, ViewType, DisplayConfig, ViewDisplay } from '../types';

/**
 * Resolved display properties for rendering.
 */
export interface ResolvedDisplay {
  title: string;
  subtitle: string | null;
  helpText: string | null;
}

/**
 * Options for display resolution.
 */
export interface ResolveDisplayOptions {
  /** The schema field to resolve display for */
  schema: SchemaField;
  /** The view context (tree, detail, table, card) */
  view: ViewType;
  /** The field name (used as ultimate fallback) */
  name: string;
  /** Optional data object for template resolution */
  data?: unknown;
  /** Optional index for array items */
  index?: number;
}

/**
 * Get a value from an object by dot-notation path.
 * Returns undefined if the path doesn't exist.
 */
function getValueByPath(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Check if a string contains template syntax ({field}).
 */
export function isTemplate(str: string): boolean {
  // Match {field} but not {{escaped}}
  return /\{[^{}]+\}/.test(str) && !/\{\{[^{}]+\}\}/.test(str);
}

/**
 * Result of template resolution.
 */
export interface TemplateResult {
  /** The resolved string */
  result: string;
  /** Whether any template variables were successfully resolved */
  hasResolvedValues: boolean;
}

/**
 * Resolve template syntax in a string using data values.
 *
 * Examples:
 * - resolveTemplate("{name}", {name: "John"}) → {result: "John", hasResolvedValues: true}
 * - resolveTemplate("{address.city}", {address: {city: "NYC"}}) → {result: "NYC", hasResolvedValues: true}
 * - resolveTemplate("User: {name}", {name: "John"}) → {result: "User: John", hasResolvedValues: true}
 * - resolveTemplate("{{literal}}", {}) → {result: "{literal}", hasResolvedValues: true}
 * - resolveTemplate("{missing}", {}) → {result: "", hasResolvedValues: false}
 */
export function resolveTemplate(template: string, data: unknown): TemplateResult {
  if (!template) return { result: '', hasResolvedValues: false };

  let hasResolvedValues = false;

  // First, handle escaped braces - replace {{ with a placeholder
  let result = template.replace(/\{\{/g, '\x00OPEN\x00').replace(/\}\}/g, '\x00CLOSE\x00');

  // Replace {field.path} with actual values
  result = result.replace(/\{([^{}]+)\}/g, (_match, path: string) => {
    const value = getValueByPath(data, path.trim());
    if (value === undefined || value === null) {
      return ''; // Return empty string for missing values
    }
    hasResolvedValues = true;
    // Convert to string
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  });

  // Replace escaped braces back
  result = result.replace(/\x00OPEN\x00/g, '{').replace(/\x00CLOSE\x00/g, '}');

  // If we have escaped braces, we consider that as having resolved values
  if (template.includes('{{')) {
    hasResolvedValues = true;
  }

  return { result, hasResolvedValues };
}

/**
 * Get the view-specific override from DisplayConfig.
 */
function getViewOverride(display: DisplayConfig | null | undefined, view: ViewType): ViewDisplay | null {
  if (!display) return null;

  switch (view) {
    case 'tree':
      return display.tree || null;
    case 'detail':
      return display.detail || null;
    case 'table':
      return display.table || null;
    case 'card':
      return display.card || null;
    default:
      return null;
  }
}

/**
 * Resolve a single display property with fallback chain.
 * Priority: view override → display config → schema → fallback
 */
function resolveProperty<T>(
  viewOverride: ViewDisplay | null,
  display: DisplayConfig | null | undefined,
  property: keyof ViewDisplay,
  schemaValue: T | undefined,
  fallback: T
): T {
  // 1. Check view-specific override
  if (viewOverride && viewOverride[property] !== null && viewOverride[property] !== undefined) {
    return viewOverride[property] as T;
  }

  // 2. Check base display config
  if (display && display[property] !== null && display[property] !== undefined) {
    return display[property] as unknown as T;
  }

  // 3. Check schema value
  if (schemaValue !== undefined && schemaValue !== null) {
    return schemaValue;
  }

  // 4. Return fallback
  return fallback;
}

/**
 * Convert field name to title case.
 * Example: "my_field_name" → "My Field Name"
 */
function nameToTitle(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolve display properties for a schema field.
 *
 * Resolution hierarchy (highest to lowest priority):
 * 1. View-specific override (display.{view}.title)
 * 2. Display config base value (display.title)
 * 3. Schema auto-generated value (schema.title, schema.description)
 * 4. Fallbacks (name for title, null for others)
 *
 * For array items with data, templates in title/subtitle are resolved.
 */
export function resolveDisplay(options: ResolveDisplayOptions): ResolvedDisplay {
  const { schema, view, name, data, index } = options;

  const display = schema.ui_config?.display;
  const viewOverride = getViewOverride(display, view);

  // Resolve raw values (before template processing)
  let rawTitle = resolveProperty<string>(
    viewOverride,
    display,
    'title',
    schema.title,
    nameToTitle(name)
  );

  let rawSubtitle = resolveProperty<string | null>(
    viewOverride,
    display,
    'subtitle',
    schema.description || null,
    null
  );

  const helpText = resolveProperty<string | null>(
    viewOverride,
    display,
    'help_text',
    null,
    null
  );

  // Apply template resolution if data is provided
  if (data !== undefined) {
    if (rawTitle && isTemplate(rawTitle)) {
      const templateResult = resolveTemplate(rawTitle, data);
      // If no template variables were successfully resolved, use fallback
      if (!templateResult.hasResolvedValues) {
        rawTitle = index !== undefined ? `Item ${index + 1}` : nameToTitle(name);
      } else {
        rawTitle = templateResult.result;
      }
    }

    if (rawSubtitle && isTemplate(rawSubtitle)) {
      const templateResult = resolveTemplate(rawSubtitle, data);
      rawSubtitle = templateResult.hasResolvedValues ? templateResult.result : null;
    }
  } else if (rawTitle && isTemplate(rawTitle) && index !== undefined) {
    // No data but we have an index - use "Item N" as fallback for template titles
    rawTitle = `Item ${index + 1}`;
  }

  return {
    title: rawTitle,
    subtitle: rawSubtitle,
    helpText,
  };
}

/**
 * Get the label for a field (shorthand for resolving just the title).
 */
export function getFieldLabel(schema: SchemaField, name: string, view: ViewType = 'detail'): string {
  return resolveDisplay({ schema, view, name }).title;
}

/**
 * Get the subtitle for a field.
 */
export function getFieldSubtitle(schema: SchemaField, view: ViewType = 'detail'): string | null {
  return resolveDisplay({ schema, view, name: '' }).subtitle;
}

/**
 * Get the help text for a field.
 */
export function getFieldHelpText(schema: SchemaField, view: ViewType = 'detail'): string | null {
  return resolveDisplay({ schema, view, name: '' }).helpText;
}

/**
 * Check if a schema represents a simple (non-complex) type that can be displayed as a value.
 */
function isSimpleType(schema: SchemaField): boolean {
  return schema.type === 'string' || 
         schema.type === 'number' || 
         schema.type === 'integer' || 
         schema.type === 'boolean';
}

/**
 * Resolve display for an array item, using item data for template resolution.
 * For simple types without custom display config, shows the value directly.
 */
export function resolveArrayItemDisplay(
  itemSchema: SchemaField,
  itemData: unknown,
  index: number,
  view: ViewType = 'tree'
): ResolvedDisplay {
  // Check if this is a simple type with no custom display configuration
  const hasCustomDisplay = itemSchema.ui_config?.display?.title || 
                          itemSchema.ui_config?.display?.[view]?.title;
  
  if (isSimpleType(itemSchema) && !hasCustomDisplay) {
    // For simple types, show the value directly as the title
    const valueAsString = itemData === null || itemData === undefined 
      ? `Item ${index + 1}` 
      : String(itemData);
    
    return {
      title: valueAsString,
      subtitle: null,
      helpText: null,
    };
  }
  
  // For complex types or types with custom display, use the standard resolution
  // For simple types with templates, wrap the value in an object with a 'value' property
  let templateData = itemData;
  if (isSimpleType(itemSchema) && hasCustomDisplay) {
    templateData = { value: itemData };
  }
  
  return resolveDisplay({
    schema: itemSchema,
    view,
    name: `Item ${index + 1}`,
    data: templateData,
    index,
  });
}

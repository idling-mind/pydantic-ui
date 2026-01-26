/**
 * Display resolution utilities.
 *
 * Provides a unified way to resolve display properties (title, subtitle, help_text, icon)
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
  icon: string | null;
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
 * Resolve template syntax in a string using data values.
 *
 * Examples:
 * - resolveTemplate("{name}", {name: "John"}) → "John"
 * - resolveTemplate("{address.city}", {address: {city: "NYC"}}) → "NYC"
 * - resolveTemplate("User: {name}", {name: "John"}) → "User: John"
 * - resolveTemplate("{{literal}}", {}) → "{literal}"
 */
export function resolveTemplate(template: string, data: unknown): string {
  if (!template) return '';

  // First, handle escaped braces - replace {{ with a placeholder
  let result = template.replace(/\{\{/g, '\x00OPEN\x00').replace(/\}\}/g, '\x00CLOSE\x00');

  // Replace {field.path} with actual values
  result = result.replace(/\{([^{}]+)\}/g, (_match, path: string) => {
    const value = getValueByPath(data, path.trim());
    if (value === undefined || value === null) {
      return ''; // Return empty string for missing values
    }
    // Convert to string
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  });

  // Restore escaped braces
  result = result.replace(/\x00OPEN\x00/g, '{').replace(/\x00CLOSE\x00/g, '}');

  return result;
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

  const icon = resolveProperty<string | null>(
    viewOverride,
    display,
    'icon',
    null,
    null
  );

  // Apply template resolution if data is provided
  if (data !== undefined) {
    if (rawTitle && isTemplate(rawTitle)) {
      const resolved = resolveTemplate(rawTitle, data);
      // If template resolves to empty, use fallback
      rawTitle = resolved || (index !== undefined ? `Item ${index + 1}` : nameToTitle(name));
    }

    if (rawSubtitle && isTemplate(rawSubtitle)) {
      const resolved = resolveTemplate(rawSubtitle, data);
      rawSubtitle = resolved || null;
    }
  } else if (rawTitle && isTemplate(rawTitle) && index !== undefined) {
    // No data but we have an index - use "Item N" as fallback for template titles
    rawTitle = `Item ${index + 1}`;
  }

  return {
    title: rawTitle,
    subtitle: rawSubtitle,
    helpText,
    icon,
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
 * Resolve display for an array item, using item data for template resolution.
 */
export function resolveArrayItemDisplay(
  itemSchema: SchemaField,
  itemData: unknown,
  index: number,
  view: ViewType = 'tree'
): ResolvedDisplay {
  return resolveDisplay({
    schema: itemSchema,
    view,
    name: `Item ${index + 1}`,
    data: itemData,
    index,
  });
}

import type { SchemaField } from '@/types';
import type { ColumnRegular, ColumnGrouping } from '@revolist/react-datagrid';
import { triggerCellEdit, triggerCellOpenEditor } from '@/components/TableView/cells';
import { getSchemaNumericBounds, getValueWithDefault, resolveOptionsFromData } from './utils';
import { resolveDisplay } from './displayUtils';

/**
 * Represents a flattened field with its full path and schema
 */
export interface FlattenedField {
  path: string;
  schema: SchemaField;
  isLeaf: boolean;
}

/**
 * Represents a row in the table with flattened values
 */
export interface FlatRow {
  __rowIndex: number;
  __originalData: unknown;
  [flatPath: string]: unknown;
}

export type ColumnWidthConfig = number | Record<string, number> | null | undefined;

const ROW_NUMBER_COLUMN_WIDTH_ALIASES = new Set([
  '__displayIndex',
  '__rowIndex',
  '__row_number',
  '#',
]);

function isValidColumnWidth(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function normalizeColumnWidthPropKey(prop: string): string {
  const normalized = prop.trim();
  if (!normalized) {
    return normalized;
  }
  if (ROW_NUMBER_COLUMN_WIDTH_ALIASES.has(normalized)) {
    return '__displayIndex';
  }
  return normalized;
}

/**
 * Resolve configured column widths into a per-column map keyed by RevoGrid column prop.
 *
 * - number: apply the same width to all data columns (private columns are excluded)
 * - dict: apply explicit per-column widths
 */
export function resolveConfiguredColumnSizes(
  flattenedFields: ReadonlyArray<FlattenedField>,
  columnWidthConfig: ColumnWidthConfig,
): Record<string, number> {
  if (isValidColumnWidth(columnWidthConfig)) {
    const sharedWidth = columnWidthConfig;
    const widths: Record<string, number> = {};
    for (const field of flattenedFields) {
      widths[field.path] = sharedWidth;
    }
    return widths;
  }

  if (!columnWidthConfig || Array.isArray(columnWidthConfig) || typeof columnWidthConfig !== 'object') {
    return {};
  }

  const widths: Record<string, number> = {};
  for (const [rawKey, rawWidth] of Object.entries(columnWidthConfig)) {
    const key = normalizeColumnWidthPropKey(rawKey);
    if (!key || !isValidColumnWidth(rawWidth)) {
      continue;
    }
    widths[key] = rawWidth;
  }

  return widths;
}

/**
 * Recursively flatten a schema to extract all leaf fields with their full paths.
 * For nested objects, creates paths like "user.name", "user.address.city"
 * 
 * @param schema - The schema to flatten
 * @param prefix - The current path prefix
 * @param maxDepth - Maximum depth to flatten (default: 5)
 * @returns Array of flattened fields with their paths
 */
export function flattenSchema(
  schema: SchemaField,
  prefix: string = '',
  maxDepth: number = 5
): FlattenedField[] {
  const results: FlattenedField[] = [];

  if (maxDepth <= 0) {
    // At max depth, treat as leaf
    return [{
      path: prefix,
      schema,
      isLeaf: true,
    }];
  }

  // Handle object type
  if (schema.type === 'object' && schema.fields) {
    for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
      const fieldPath = prefix ? `${prefix}.${fieldName}` : fieldName;
      
      // Skip hidden fields
      if (fieldSchema.ui_config?.hidden) continue;

      // Recursively flatten nested objects
      if (fieldSchema.type === 'object' && fieldSchema.fields) {
        results.push(...flattenSchema(fieldSchema, fieldPath, maxDepth - 1));
      } else if (fieldSchema.type === 'array') {
        // For arrays within array items, we just show them as a column (non-editable or JSON)
        results.push({
          path: fieldPath,
          schema: fieldSchema,
          isLeaf: true,
        });
      } else {
        // Primitive field
        results.push({
          path: fieldPath,
          schema: fieldSchema,
          isLeaf: true,
        });
      }
    }
  } else {
    // Not an object, treat the schema itself as a leaf
    results.push({
      path: prefix,
      schema,
      isLeaf: true,
    });
  }

  return results;
}

/**
 * Get a value from a nested object using dot notation path.
 * Handles paths like "user.name" or "address.city"
 * 
 * @param obj - The object to get the value from
 * @param path - Dot-notation path
 * @returns The value at the path, or undefined if not found
 */
export function getValueByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  if (obj === null || obj === undefined) return undefined;

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a value in a nested object using dot notation path.
 * Creates intermediate objects if they don't exist.
 * Returns a new object (immutable).
 * 
 * @param obj - The object to update
 * @param path - Dot-notation path
 * @param value - The value to set
 * @returns A new object with the updated value
 */
export function setValueByPath(obj: unknown, path: string, value: unknown): unknown {
  if (!path) return value;

  const parts = path.split('.');
  const result = obj && typeof obj === 'object' && !Array.isArray(obj)
    ? { ...(obj as Record<string, unknown>) }
    : {};

  if (parts.length === 1) {
    result[parts[0]] = value;
    return result;
  }

  const [first, ...rest] = parts;
  result[first] = setValueByPath(result[first], rest.join('.'), value);

  return result;
}

/**
 * Convert an array of nested objects into flat rows for AG Grid.
 * Each row has the array index as __rowIndex and flattened field values.
 * 
 * @param data - Array of nested objects
 * @param flattenedFields - The flattened schema fields
 * @returns Array of flat rows
 */
export function arrayToFlatRows(
  data: unknown[],
  flattenedFields: FlattenedField[]
): FlatRow[] {
  return data.map((item, index) => {
    const row: FlatRow = {
      __rowIndex: index,
      __originalData: item,
    };

    for (const field of flattenedFields) {
      const rawValue = getValueByPath(item, field.path);
      row[field.path] = getValueWithDefault(rawValue, field.schema);
    }

    return row;
  });
}

/**
 * Convert a flat row back to a nested object structure.
 * 
 * @param row - The flat row
 * @param flattenedFields - The flattened schema fields
 * @returns A nested object
 */
export function flatRowToNestedObject(
  row: FlatRow,
  flattenedFields: FlattenedField[]
): unknown {
  let result: unknown = {};

  for (const field of flattenedFields) {
    const value = row[field.path];
    if (value !== undefined) {
      result = setValueByPath(result, field.path, value);
    }
  }

  return result;
}

/**
 * Calculate min and max values for a numeric column.
 * 
 * @param data - Array of flat rows
 * @param path - Column path
 * @returns Object with min and max values
 */
export function calculateColumnMinMax(
  data: FlatRow[],
  path: string
): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;

  for (const row of data) {
    const value = row[path];
    if (typeof value === 'number' && !isNaN(value)) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  // If no numeric values found, return 0-1 range
  if (min === Infinity || max === -Infinity) {
    return { min: 0, max: 1 };
  }

  // If all values are the same, expand range slightly
  if (min === max) {
    return { min: min - 1, max: max + 1 };
  }

  return { min, max };
}

/**
 * Get a color for a numeric value based on a gradient scale.
 * 
 * @param value - The numeric value
 * @param min - Minimum value in the range
 * @param max - Maximum value in the range
 * @param colorScale - Color scale type: 'blue-red', 'green-red', 'blue-white-red'
 * @returns CSS color string
 */
export function getColorForValue(
  value: number,
  min: number,
  max: number,
  colorScale: 'blue-red' | 'green-red' | 'blue-white-red' = 'blue-white-red'
): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return 'transparent';
  }

  // Normalize to 0-1 range
  const range = max - min;
  const normalized = range === 0 ? 0.5 : (value - min) / range;

  switch (colorScale) {
    case 'blue-red': {
      // Blue (low) -> Purple (mid) -> Red (high)
      const r = Math.round(normalized * 255);
      const g = 0;
      const b = Math.round((1 - normalized) * 255);
      return `rgba(${r}, ${g}, ${b}, 0.3)`;
    }
    case 'green-red': {
      // Green (low) -> Yellow (mid) -> Red (high)
      const r = Math.round(normalized * 255);
      const g = Math.round((1 - normalized) * 255);
      const b = 0;
      return `rgba(${r}, ${g}, ${b}, 0.3)`;
    }
    case 'blue-white-red':
    default: {
      // Blue (low) -> White (mid) -> Red (high)
      if (normalized < 0.5) {
        // Blue to white
        const intensity = normalized * 2; // 0 to 1
        const r = Math.round(intensity * 255);
        const g = Math.round(intensity * 255);
        const b = 255;
        return `rgba(${r}, ${g}, ${b}, 0.4)`;
      } else {
        // White to red
        const intensity = (normalized - 0.5) * 2; // 0 to 1
        const r = 255;
        const g = Math.round((1 - intensity) * 255);
        const b = Math.round((1 - intensity) * 255);
        return `rgba(${r}, ${g}, ${b}, 0.4)`;
      }
    }
  }
}

interface TableColumnDefOptions {
  readOnly?: boolean;
  pinnedColumnsStart?: ReadonlySet<string>;
  data?: Record<string, unknown>;
}

const BOOLEAN_RENDERERS = new Set(['checkbox', 'toggle', 'switch']);
const SINGLE_SELECT_RENDERERS = new Set([
  'select',
  'radio_group',
  'segmented_control',
]);
const MULTI_SELECT_RENDERERS = new Set(['multi_select', 'checklist']);
const DATE_RENDERERS = new Set(['date', 'datetime', 'date_picker', 'datetime_picker']);
const COLOR_RENDERERS = new Set(['color', 'color_picker']);
const TEXTAREA_RENDERERS = new Set(['textarea', 'text_area', 'markdown']);
const JSON_RENDERERS = new Set(['json', 'union', 'union_select', 'union_tabs']);
const NUMERIC_RENDERERS = new Set(['number', 'number_input', 'slider', 'range']);

function isObjectWithValue(x: unknown): x is { value: unknown } {
  return typeof x === 'object' && x !== null && 'value' in x;
}

function getOptionsFromUiProps(schema: SchemaField): string[] {
  const options = schema.ui_config?.props?.options;
  if (!Array.isArray(options)) {
    return [];
  }

  const values = options
    .map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number' || typeof opt === 'boolean') {
        return String(opt);
      }
      if (isObjectWithValue(opt)) {
        return String(opt.value);
      }
      return null;
    })
    .filter((value): value is string => value !== null);

  return [...new Set(values)];
}

function getOptionsFromDataSource(
  schema: SchemaField,
  data?: Record<string, unknown>,
): string[] {
  const optionsFromPath = schema.ui_config?.options_from;
  if (!optionsFromPath || !data) {
    return [];
  }

  const resolved = resolveOptionsFromData(optionsFromPath, data)
    .map((option) => option.value);

  return [...new Set(resolved)];
}

function getEnumValues(schema: SchemaField, data?: Record<string, unknown>): string[] {
  const optionsFromData = getOptionsFromDataSource(schema, data);
  if (optionsFromData.length > 0) {
    return optionsFromData;
  }

  const optionsFromProps = getOptionsFromUiProps(schema);
  if (optionsFromProps.length > 0) {
    return optionsFromProps;
  }

  if (Array.isArray(schema.enum)) {
    return schema.enum.map((value) => String(value));
  }
  if (Array.isArray(schema.literal_values)) {
    return schema.literal_values.map((value) => String(value));
  }
  return [];
}

function getMultiSelectValues(schema: SchemaField, data?: Record<string, unknown>): string[] {
  const optionsFromData = getOptionsFromDataSource(schema, data);
  if (optionsFromData.length > 0) {
    return optionsFromData;
  }

  const optionsFromProps = getOptionsFromUiProps(schema);
  if (optionsFromProps.length > 0) {
    return optionsFromProps;
  }

  if (!schema.items) {
    return [];
  }
  return getEnumValues(schema.items, data);
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function getNumericMeta(schema: SchemaField): {
  minimum: number | undefined;
  maximum: number | undefined;
  step: number;
} {
  const props = schema.ui_config?.props;
  const minFromProps = toFiniteNumber(props?.min);
  const maxFromProps = toFiniteNumber(props?.max);
  const stepFromProps = toFiniteNumber(props?.step);
  const schemaBounds = getSchemaNumericBounds(schema);

  const minimum =
    minFromProps
      ?? schemaBounds.minimum;
  const maximum =
    maxFromProps
      ?? schemaBounds.maximum;
  const fallbackStep = schema.type === 'integer' ? 1 : 0.1;
  const step =
    stepFromProps
      ?? schemaBounds.step
      ?? fallbackStep;

  return {
    minimum,
    maximum,
    step,
  };
}

/**
 * Coerce table cell values according to schema type.
 *
 * Clipboard/range edits can provide string payloads for numeric fields.
 * Converting those values before writing state keeps numeric behaviors
 * (sorting, filtering, conditional formatting) consistent.
 */
export function coerceTableCellValueBySchema(
  schema: SchemaField | undefined,
  value: unknown,
): unknown {
  if (!schema) {
    return value;
  }

  if (schema.type !== 'integer' && schema.type !== 'number') {
    return value;
  }

  if (value === null || value === undefined) {
    return value;
  }

  let parsed: number | null | undefined;

  if (typeof value === 'number') {
    parsed = Number.isFinite(value) ? value : undefined;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      parsed = null;
    } else {
      const candidate = Number(trimmed);
      parsed = Number.isFinite(candidate) ? candidate : undefined;
    }
  }

  if (parsed === undefined) {
    return value;
  }

  if (parsed === null) {
    return null;
  }

  return schema.type === 'integer' ? Math.trunc(parsed) : parsed;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
  }
  return Boolean(value);
}

function getTemplateRowIndex(props: { model: Record<string, unknown>; rowIndex?: number }): number | null {
  const modelIndex = props.model.__rowIndex;
  if (typeof modelIndex === 'number' && Number.isFinite(modelIndex)) {
    return modelIndex;
  }
  if (typeof props.rowIndex === 'number' && Number.isFinite(props.rowIndex)) {
    return props.rowIndex;
  }
  return null;
}

function formatDateCell(value: unknown, includeTime: boolean): string {
  if (!value) {
    return '—';
  }
  const date = new Date(String(value));
  if (isNaN(date.getTime())) {
    return String(value);
  }

  if (includeTime) {
    return date.toLocaleString();
  }
  return date.toLocaleDateString();
}

function isHTMLElement(target: unknown): target is HTMLElement {
  return typeof HTMLElement !== 'undefined' && target instanceof HTMLElement;
}

function emitCellEdit(
  event: Event,
  rowIndex: number,
  prop: string,
  nextValue: unknown,
): void {
  const element = event.currentTarget;
  if (!isHTMLElement(element)) {
    return;
  }
  triggerCellEdit(element, rowIndex, prop, nextValue);
}

function emitOpenEditor(event: Event, rowIndex: number, prop: string): void {
  const element = event.currentTarget;
  if (!isHTMLElement(element)) {
    return;
  }
  triggerCellOpenEditor(element, rowIndex, prop);
}

/**
 * Resolve the renderer type for table cells using the same logic as main field renderers.
 */
export function getTableRenderer(schema: SchemaField): string {
  const configuredRenderer = schema.ui_config?.renderer;
  if (configuredRenderer && configuredRenderer !== 'auto') {
    return configuredRenderer;
  }

  if (schema.type === 'union' && schema.variants) {
    return schema.variants.length <= 4 ? 'union_tabs' : 'union_select';
  }

  if (schema.enum || schema.literal_values) {
    return 'select';
  }

  switch (schema.type) {
    case 'string':
      if (schema.format === 'date') return 'date_picker';
      if (schema.format === 'date-time') return 'datetime_picker';
      if (schema.format === 'color') return 'color_picker';
      if (schema.max_length && schema.max_length > 200) return 'text_area';
      return 'text_input';

    case 'integer':
    case 'number': {
      const numericMeta = getNumericMeta(schema);
      if (
        numericMeta.minimum !== undefined &&
        numericMeta.maximum !== undefined &&
        numericMeta.maximum - numericMeta.minimum <= 1000
      ) {
        return 'slider';
      }
      return 'number_input';
    }

    case 'boolean':
      return 'toggle';

    case 'array':
      if (schema.items && (schema.items.enum || schema.items.literal_values)) {
        return 'multi_select';
      }
      return 'array';

    case 'object':
      return schema.fields ? 'object' : 'json';

    default:
      return 'json';
  }
}

/**
 * Create a cellTemplate function for a given field.
 * Returns a VNode-based cell template for RevoGrid columns.
 * Adds lightweight visual parity with main renderers and supports custom
 * event-driven interactions for boolean toggles and editor launching.
 *
 * @param field - The flattened field
 * @param options - Column-level options
 * @returns A cellTemplate function or undefined
 */
export function createCellTemplate(
  field: FlattenedField,
  options: TableColumnDefOptions = {},
): ColumnRegular['cellTemplate'] | undefined {
  const renderer = getTableRenderer(field.schema);
  const isBoolean = field.schema.type === 'boolean' || BOOLEAN_RENDERERS.has(renderer);
  const isSelect = SINGLE_SELECT_RENDERERS.has(renderer);
  const isMultiSelect = MULTI_SELECT_RENDERERS.has(renderer);
  const isDate = DATE_RENDERERS.has(renderer);
  const isColor = COLOR_RENDERERS.has(renderer);
  const isSlider = renderer === 'slider' || renderer === 'range';
  const isLongText = TEXTAREA_RENDERERS.has(renderer) || JSON_RENDERERS.has(renderer);
  const isArray = field.schema.type === 'array';
  const isReadOnly = !!(options.readOnly || field.schema.ui_config?.read_only);

  if (isBoolean) {
    return (h, props) => {
      const checked = toBoolean(props.model[props.prop]);
      const rowIndex = getTemplateRowIndex(props);
      const prop = String(props.prop);
      const disabled = isReadOnly || rowIndex === null;
      const isCheckboxStyle = renderer === 'checkbox';

      const toggleValue = (event: Event) => {
        event.stopPropagation();
        if (disabled || rowIndex === null) {
          return;
        }
        emitCellEdit(event, rowIndex, prop, !checked);
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        toggleValue(event);
      };

      if (isCheckboxStyle) {
        return h(
          'button',
          {
            type: 'button',
            tabIndex: disabled ? -1 : 0,
            disabled,
            'aria-label': `Toggle ${prop}`,
            style: {
              width: '100%',
              height: '100%',
              padding: '0 8px',
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? '0.65' : '1',
            },
            onClick: toggleValue,
            onKeyDown: handleKeyDown,
          },
          h(
            'span',
            {
              style: {
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${checked ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                backgroundColor: checked ? 'hsl(var(--primary))' : 'hsl(var(--background))',
                color: checked ? 'hsl(var(--primary-foreground))' : 'transparent',
                fontSize: '11px',
                fontWeight: '700',
                transition: 'all 120ms ease',
              },
            },
            checked ? '✓' : '',
          ),
        );
      }

      return h(
        'button',
        {
          type: 'button',
          tabIndex: disabled ? -1 : 0,
          disabled,
          'aria-label': `Toggle ${prop}`,
          style: {
            width: '100%',
            height: '100%',
            padding: '0 8px',
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? '0.65' : '1',
          },
          onClick: toggleValue,
          onKeyDown: handleKeyDown,
        },
        h(
          'span',
          {
            style: {
              width: '34px',
              height: '20px',
              borderRadius: '999px',
              backgroundColor: checked ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
              border: `1px solid ${checked ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              transition: 'all 120ms ease',
            },
          },
          h('span', {
            style: {
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: 'hsl(var(--background))',
              position: 'absolute',
              top: '2px',
              left: '2px',
              transform: checked ? 'translateX(14px)' : 'translateX(0px)',
              transition: 'transform 120ms ease',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
            },
          }),
        ),
      );
    };
  }

  if (isColor) {
    return (h, props) => {
      const val = props.model[props.prop];
      const rowIndex = getTemplateRowIndex(props);
      const prop = String(props.prop);
      const disabled = isReadOnly || rowIndex === null;

      const openEditor = (event: Event) => {
        event.stopPropagation();
        if (disabled || rowIndex === null) {
          return;
        }
        emitOpenEditor(event, rowIndex, prop);
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        openEditor(event);
      };

      if (!val) {
        return h(
          'span',
          {
            style: {
              color: 'hsl(var(--muted-foreground))',
              padding: '0 8px',
              display: 'inline-flex',
              alignItems: 'center',
              height: '100%',
            },
          },
          '—',
        );
      }

      return h(
        'button',
        {
          type: 'button',
          tabIndex: disabled ? -1 : 0,
          disabled,
          'aria-label': `Edit ${prop}`,
          style: {
            width: '100%',
            height: '100%',
            padding: '0 8px',
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: disabled ? 'default' : 'pointer',
            textAlign: 'left',
          },
          onClick: openEditor,
          onKeyDown: handleKeyDown,
        },
        [
          h('span', {
            style: {
              display: 'inline-block',
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              backgroundColor: String(val),
              border: '1px solid hsl(var(--border))',
              flexShrink: '0',
            },
          }),
          h(
            'span',
            {
              style: {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
            },
            String(val),
          ),
        ],
      );
    };
  }

  if (isMultiSelect || isSelect) {
    return (h, props) => {
      const val = props.model[props.prop];
      const rowIndex = getTemplateRowIndex(props);
      const prop = String(props.prop);
      const disabled = isReadOnly || rowIndex === null;

      const openEditor = (event: Event) => {
        event.stopPropagation();
        if (disabled || rowIndex === null) {
          return;
        }
        emitOpenEditor(event, rowIndex, prop);
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        openEditor(event);
      };

      if (isSelect) {
        const text = val === null || val === undefined || val === '' ? '—' : String(val);
        const isEmpty = text === '—';
        const handleMouseDown = (event: MouseEvent) => {
          event.preventDefault();
          openEditor(event);
        };

        return h(
          'button',
          {
            type: 'button',
            tabIndex: disabled ? -1 : 0,
            disabled,
            'aria-label': `Edit ${prop}`,
            style: {
              width: '100%',
              height: '100%',
              padding: '0 8px',
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: disabled ? 'default' : 'pointer',
              textAlign: 'left',
            },
            onMouseDown: handleMouseDown,
            onClick: (event: Event) => event.stopPropagation(),
            onKeyDown: handleKeyDown,
          },
          [
            h(
              'span',
              {
                style: {
                  maxWidth: 'calc(100% - 14px)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: isEmpty ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
                },
              },
              text,
            ),
            h(
              'span',
              {
                style: {
                  marginLeft: 'auto',
                  color: 'hsl(var(--muted-foreground))',
                  fontSize: '10px',
                  lineHeight: 1,
                },
              },
              '▾',
            ),
          ],
        );
      }

      if (!Array.isArray(val) || val.length === 0) {
        return h(
          'span',
          {
            style: {
              color: 'hsl(var(--muted-foreground))',
              padding: '0 8px',
              display: 'inline-flex',
              alignItems: 'center',
              height: '100%',
            },
          },
          '—',
        );
      }

      const values = val.map((v) => String(v));
      const visibleValues = values.slice(0, 2);
      const hiddenCount = values.length - visibleValues.length;

      return h(
        'button',
        {
          type: 'button',
          tabIndex: disabled ? -1 : 0,
          disabled,
          'aria-label': `Edit ${prop}`,
          style: {
            width: '100%',
            height: '100%',
            padding: '0 8px',
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            overflow: 'hidden',
            cursor: disabled ? 'default' : 'pointer',
          },
          onClick: openEditor,
          onKeyDown: handleKeyDown,
        },
        [
          ...visibleValues.map((item) =>
            h(
              'span',
              {
                style: {
                  display: 'inline-block',
                  maxWidth: '90px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  borderRadius: '999px',
                  border: '1px solid hsl(var(--border))',
                  backgroundColor: 'hsl(var(--secondary))',
                  color: 'hsl(var(--secondary-foreground))',
                  fontSize: '11px',
                  lineHeight: 1.3,
                  padding: '2px 7px',
                },
              },
              item,
            ),
          ),
          hiddenCount > 0
            ? h(
                'span',
                {
                  style: {
                    fontSize: '11px',
                    color: 'hsl(var(--muted-foreground))',
                  },
                },
                `+${hiddenCount}`,
              )
            : null,
        ].filter(Boolean),
      );
    };
  }

  if (isDate) {
    const includeTime = renderer === 'datetime' || renderer === 'datetime_picker';
    return (h, props) => {
      const rowIndex = getTemplateRowIndex(props);
      const prop = String(props.prop);
      const disabled = isReadOnly || rowIndex === null;
      const text = formatDateCell(props.model[props.prop], includeTime);

      const openEditor = (event: Event) => {
        event.stopPropagation();
        if (disabled || rowIndex === null) {
          return;
        }
        emitOpenEditor(event, rowIndex, prop);
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        openEditor(event);
      };

      return h(
        'button',
        {
          type: 'button',
          tabIndex: disabled ? -1 : 0,
          disabled,
          'aria-label': `Edit ${prop}`,
          style: {
            width: '100%',
            height: '100%',
            padding: '0 8px',
            border: 'none',
            background: 'transparent',
            textAlign: 'left',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: text === '—' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
            cursor: disabled ? 'default' : 'pointer',
          },
          onClick: openEditor,
          onKeyDown: handleKeyDown,
        },
        text,
      );
    };
  }

  if (isSlider) {
    const numericMeta = getNumericMeta(field.schema);
    const min = numericMeta.minimum ?? 0;
    const max = numericMeta.maximum ?? 100;
    const safeMax = max <= min ? min + 1 : max;

    return (h, props) => {
      const value = props.model[props.prop];
      const numericValue = typeof value === 'number' ? value : Number(value);
      const hasNumber = !isNaN(numericValue);
      const percent = hasNumber ? Math.min(100, Math.max(0, ((numericValue - min) / (safeMax - min)) * 100)) : 0;
      const rowIndex = getTemplateRowIndex(props);
      const prop = String(props.prop);
      const disabled = isReadOnly || rowIndex === null;

      const openEditor = (event: Event) => {
        event.stopPropagation();
        if (disabled || rowIndex === null) {
          return;
        }
        emitOpenEditor(event, rowIndex, prop);
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        openEditor(event);
      };

      return h(
        'button',
        {
          type: 'button',
          tabIndex: disabled ? -1 : 0,
          disabled,
          'aria-label': `Edit ${prop}`,
          style: {
            width: '100%',
            height: '100%',
            padding: '0 8px',
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: disabled ? 'default' : 'pointer',
          },
          onClick: openEditor,
          onKeyDown: handleKeyDown,
        },
        [
          h('span', {
            style: {
              position: 'relative',
              flex: '1',
              height: '4px',
              borderRadius: '999px',
              backgroundColor: 'hsl(var(--muted))',
              overflow: 'hidden',
            },
          },
          h('span', {
            style: {
              display: 'block',
              height: '100%',
              width: `${percent}%`,
              backgroundColor: 'hsl(var(--primary))',
            },
          })),
          h(
            'span',
            {
              style: {
                minWidth: '24px',
                color: hasNumber ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                fontSize: '11px',
                fontVariantNumeric: 'tabular-nums',
              },
            },
            hasNumber ? String(numericValue) : '—',
          ),
        ],
      );
    };
  }

  if (isLongText) {
    return (h, props) => {
      const value = props.model[props.prop];
      const rowIndex = getTemplateRowIndex(props);
      const prop = String(props.prop);
      const disabled = isReadOnly || rowIndex === null;
      const text =
        value === null || value === undefined
          ? '—'
          : typeof value === 'string'
          ? value
          : JSON.stringify(value);

      const openEditor = (event: Event) => {
        event.stopPropagation();
        if (disabled || rowIndex === null) {
          return;
        }
        emitOpenEditor(event, rowIndex, prop);
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        openEditor(event);
      };

      return h(
        'button',
        {
          type: 'button',
          tabIndex: disabled ? -1 : 0,
          disabled,
          'aria-label': `Edit ${prop}`,
          style: {
            width: '100%',
            height: '100%',
            padding: '0 8px',
            border: 'none',
            background: 'transparent',
            textAlign: 'left',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: text === '—' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
            cursor: disabled ? 'default' : 'pointer',
          },
          onClick: openEditor,
          onKeyDown: handleKeyDown,
        },
        text,
      );
    };
  }

  if (isArray) {
    return (h, props) => {
      const val = props.model[props.prop];
      const text = Array.isArray(val) ? `[${val.length} items]` : '-';
      return h(
        'span',
        {
          style: {
            color: 'hsl(var(--muted-foreground))',
            padding: '0 8px',
            display: 'inline-flex',
            alignItems: 'center',
            height: '100%',
          },
        },
        text,
      );
    };
  }

  return undefined;
}

/**
 * Create a leaf column definition for RevoGrid.
 */
function createLeafColumnDef(
  field: FlattenedField,
  headerName: string,
  options: TableColumnDefOptions = {},
): ColumnRegular {
  const renderer = getTableRenderer(field.schema);
  const isNumeric = field.schema.type === 'integer' || field.schema.type === 'number';
  const isBoolean = field.schema.type === 'boolean' || BOOLEAN_RENDERERS.has(renderer);
  const isMultiSelect = MULTI_SELECT_RENDERERS.has(renderer);
  const isArray = field.schema.type === 'array';
  const hasEnum = getEnumValues(field.schema, options.data).length > 0;
  const isArrayReadOnly = isArray && !isMultiSelect;
  const isReadOnly = !!(options.readOnly || field.schema.ui_config?.read_only || isArrayReadOnly);
  const numericMeta = getNumericMeta(field.schema);

  const display = resolveDisplay({ schema: field.schema, view: 'table', name: headerName });

  // Filter type
  let filterType: string | boolean = true;
  if (isNumeric) {
    filterType = 'number';
  }

  const cellTemplate = createCellTemplate(field, { readOnly: isReadOnly });

  const colDef: ColumnRegular = {
    prop: field.path,
    name: display.title,
    sortable: true,
    filter: filterType,
    minSize: 80,
    pin: options.pinnedColumnsStart?.has(field.path) ? 'colPinStart' : undefined,
    readonly: isReadOnly || isBoolean,
    __renderer: renderer,
    ...(cellTemplate ? { cellTemplate } : {}),
  };

  // Determine the effective editor based on renderer and field type.
  // Boolean columns use event-driven toggles, so native editor is intentionally disabled.
  if (!colDef.readonly) {
    if (DATE_RENDERERS.has(renderer)) {
      colDef.editor = 'date';
      colDef.__includeTime = renderer === 'datetime_picker' || renderer === 'datetime';
    } else if (COLOR_RENDERERS.has(renderer)) {
      colDef.editor = 'color';
    } else if (isMultiSelect) {
      colDef.editor = 'multiselect';
      colDef.__enumValues = getMultiSelectValues(field.schema, options.data);
    } else if (SINGLE_SELECT_RENDERERS.has(renderer) || hasEnum) {
      colDef.editor = 'select';
      colDef.__enumValues = getEnumValues(field.schema, options.data);
    } else if (TEXTAREA_RENDERERS.has(renderer)) {
      colDef.editor = 'textarea';
    } else if (JSON_RENDERERS.has(renderer) || field.schema.type === 'object') {
      colDef.editor = 'json';
    } else if (renderer === 'slider' || renderer === 'range') {
      colDef.editor = 'slider';
      colDef.__isInteger = field.schema.type === 'integer';
      colDef.__minimum = numericMeta.minimum;
      colDef.__maximum = numericMeta.maximum;
      colDef.__step = numericMeta.step;
    } else if (NUMERIC_RENDERERS.has(renderer) || isNumeric) {
      colDef.editor = 'number';
      colDef.__isInteger = field.schema.type === 'integer';
      colDef.__minimum = numericMeta.minimum;
      colDef.__maximum = numericMeta.maximum;
      colDef.__step = numericMeta.step;
    } else {
      colDef.editor = 'text';
    }
  }

  // Numeric cell color gradient via cellProperties (dynamic, uses live data)
  if (isNumeric) {
    colDef.cellProperties = (props) => {
      const val = props.model[props.prop];
      if (typeof val !== 'number' || isNaN(val)) return undefined;

      // Calculate minMax from current full dataset
      let min = Infinity;
      let max = -Infinity;
      if (props.data) {
        for (const row of props.data) {
          const v = row[props.prop];
          if (typeof v === 'number' && !isNaN(v)) {
            min = Math.min(min, v);
            max = Math.max(max, v);
          }
        }
      }
      if (min === Infinity) { min = 0; max = 1; }
      if (min === max) { min -= 1; max += 1; }

      return {
        style: { backgroundColor: getColorForValue(val, min, max) },
      };
    };
  }

  return colDef;
}

/**
 * Generate RevoGrid column definitions from flattened schema fields.
 * Creates hierarchical column groups for nested objects.
 *
 * @param flattenedFields - Array of flattened fields
 * @returns Array of RevoGrid column definitions with column groups
 */
export function generateColumnDefs(
  flattenedFields: FlattenedField[],
  options: TableColumnDefOptions = {},
): (ColumnRegular | ColumnGrouping)[] {
  // Build a tree structure from the flattened fields
  interface ColumnNode {
    name: string;
    path: string;
    field?: FlattenedField;
    children: Map<string, ColumnNode>;
  }

  const root: ColumnNode = {
    name: '',
    path: '',
    children: new Map(),
  };

  for (const field of flattenedFields) {
    const parts = field.path.split('.');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('.');

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: currentPath,
          children: new Map(),
        });
      }

      const node = current.children.get(part)!;

      if (isLast) {
        node.field = field;
      }

      current = node;
    }
  }

  const convertToColDefs = (
    node: ColumnNode,
  ): (ColumnRegular | ColumnGrouping)[] => {
    const results: (ColumnRegular | ColumnGrouping)[] = [];

    for (const [name, child] of node.children) {
      if (child.field && child.children.size === 0) {
        results.push(createLeafColumnDef(child.field, name, options));
      } else if (child.children.size > 0) {
        const children = convertToColDefs(child);

        if (child.field) {
          children.unshift(createLeafColumnDef(child.field, name, options));
        }

        const colGroup: ColumnGrouping = {
          name,
          children,
        };
        results.push(colGroup);
      }
    }

    return results;
  };

  return convertToColDefs(root);
}

/**
 * Generate flat RevoGrid column definitions (without grouping).
 *
 * @param flattenedFields - Array of flattened fields
 * @returns Array of RevoGrid column definitions
 */
export function generateFlatColumnDefs(
  flattenedFields: FlattenedField[],
  options: TableColumnDefOptions = {},
): ColumnRegular[] {
  return flattenedFields.map((field) =>
    createLeafColumnDef(field, field.path, options),
  );
}

function applyColumnSizesToDefs(
  columnDefs: (ColumnRegular | ColumnGrouping)[],
  sizesByProp: Readonly<Record<string, number>>,
): (ColumnRegular | ColumnGrouping)[] {
  let changed = false;

  const nextDefs = columnDefs.map((columnDef) => {
    if ('children' in columnDef && Array.isArray(columnDef.children)) {
      const nextChildren = applyColumnSizesToDefs(columnDef.children, sizesByProp);
      if (nextChildren !== columnDef.children) {
        changed = true;
        return {
          ...columnDef,
          children: nextChildren,
        };
      }
      return columnDef;
    }

    if (!('prop' in columnDef)) {
      return columnDef;
    }

    const nextSize = sizesByProp[String(columnDef.prop)];
    if (typeof nextSize !== 'number' || !Number.isFinite(nextSize) || columnDef.size === nextSize) {
      return columnDef;
    }

    changed = true;
    return {
      ...columnDef,
      size: nextSize,
    };
  });

  return changed ? nextDefs : columnDefs;
}

/**
 * Apply persisted per-column sizes by column prop to a column definition tree.
 */
export function applyColumnSizes(
  columnDefs: (ColumnRegular | ColumnGrouping)[],
  sizesByProp: Readonly<Record<string, number>>,
): (ColumnRegular | ColumnGrouping)[] {
  if (Object.keys(sizesByProp).length === 0) {
    return columnDefs;
  }

  return applyColumnSizesToDefs(columnDefs, sizesByProp);
}

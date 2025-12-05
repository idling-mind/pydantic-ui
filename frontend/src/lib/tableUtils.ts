import type { SchemaField } from '@/types';
import type { ColDef, ColGroupDef, ValueGetterParams, ValueSetterParams } from 'ag-grid-community';

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
      row[field.path] = getValueByPath(item, field.path);
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

/**
 * Get the appropriate AG Grid cell editor type based on schema field type.
 * 
 * @param schema - The field schema
 * @returns AG Grid cell editor configuration
 */
export function getCellEditorForType(schema: SchemaField): {
  cellEditor?: string;
  cellEditorParams?: Record<string, unknown>;
} {
  // Check for enum or literal values first
  if (schema.enum || schema.literal_values) {
    const values = schema.enum || schema.literal_values || [];
    return {
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: values,
      },
    };
  }

  switch (schema.type) {
    case 'boolean':
      return {
        cellEditor: 'agCheckboxCellEditor',
      };
    case 'integer':
    case 'number':
      return {
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: schema.minimum,
          max: schema.maximum,
          precision: schema.type === 'integer' ? 0 : undefined,
        },
      };
    case 'string':
    default:
      // Check for multiline text
      if (schema.max_length && schema.max_length > 100) {
        return {
          cellEditor: 'agLargeTextCellEditor',
          cellEditorParams: {
            maxLength: schema.max_length,
            rows: 5,
            cols: 50,
          },
        };
      }
      return {
        cellEditor: 'agTextCellEditor',
      };
  }
}

/**
 * Generate AG Grid column definitions from flattened schema fields.
 * Creates hierarchical column groups for nested objects.
 * 
 * @param flattenedFields - Array of flattened fields
 * @param rowData - The row data (for calculating numeric ranges)
 * @returns Array of AG Grid column definitions with column groups
 */
export function generateColumnDefs(
  flattenedFields: FlattenedField[],
  rowData: FlatRow[]
): (ColDef | ColGroupDef)[] {
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

  // Build the tree from flattened fields
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

  // Helper to create a leaf column definition
  const createLeafColDef = (field: FlattenedField, headerName: string): ColDef => {
    const isNumeric = field.schema.type === 'integer' || field.schema.type === 'number';
    const isBoolean = field.schema.type === 'boolean';
    const isArray = field.schema.type === 'array';
    const hasEnum = !!(field.schema.enum || field.schema.literal_values);

    // Calculate min/max for numeric columns
    let minMax: { min: number; max: number } | undefined;
    if (isNumeric && rowData.length > 0) {
      minMax = calculateColumnMinMax(rowData, field.path);
    }

    // Get cell editor configuration
    const editorConfig = getCellEditorForType(field.schema);

    // Determine the appropriate filter type (Community edition only)
    let filterType: string | boolean = true;
    if (isNumeric) {
      filterType = 'agNumberColumnFilter';
    } else if (isBoolean || hasEnum) {
      // Use text filter for booleans/enums since SetFilter requires Enterprise
      filterType = 'agTextColumnFilter';
    } else if (field.schema.type === 'string') {
      filterType = 'agTextColumnFilter';
    }

    const colDef: ColDef = {
      field: field.path,
      headerName: headerName,
      headerTooltip: field.schema.description || field.path,
      editable: !field.schema.ui_config?.read_only && !isArray,
      sortable: true,
      filter: filterType,
      resizable: true,
      minWidth: 80,
      flex: 1,
      ...editorConfig,
      // Value getter to handle nested paths
      valueGetter: (params: ValueGetterParams) => {
        return params.data?.[field.path];
      },
      // Value setter to update the row data
      valueSetter: (params: ValueSetterParams) => {
        if (params.data) {
          params.data[field.path] = params.newValue;
          return true;
        }
        return false;
      },
    };

    // Add cell style for numeric columns (color by value)
    if (isNumeric && minMax) {
      const { min, max } = minMax;
      colDef.cellStyle = (params) => {
        const value = params.value;
        if (typeof value !== 'number' || isNaN(value)) {
          return undefined;
        }
        const bgColor = getColorForValue(value, min, max);
        return { backgroundColor: bgColor };
      };
    }

    // Add cell renderer for boolean columns
    if (isBoolean) {
      colDef.cellRenderer = (params: { value: unknown }) => {
        return params.value ? '✓' : '✗';
      };
    }

    // For arrays, show as non-editable summary
    if (isArray) {
      colDef.cellRenderer = (params: { value: unknown }) => {
        if (Array.isArray(params.value)) {
          return `[${params.value.length} items]`;
        }
        return '-';
      };
    }

    // For enum/literal values, ensure proper display
    if (hasEnum) {
      colDef.cellRenderer = (params: { value: unknown }) => {
        return params.value !== undefined && params.value !== null 
          ? String(params.value) 
          : '';
      };
    }

    return colDef;
  };

  // Recursively convert tree to column definitions
  const convertToColDefs = (node: ColumnNode): (ColDef | ColGroupDef)[] => {
    const results: (ColDef | ColGroupDef)[] = [];

    for (const [name, child] of node.children) {
      if (child.field && child.children.size === 0) {
        // Leaf node - create a column
        results.push(createLeafColDef(child.field, name));
      } else if (child.children.size > 0) {
        // Group node - create a column group
        const children = convertToColDefs(child);
        
        // If this node also has a field (edge case), add it as a column
        if (child.field) {
          children.unshift(createLeafColDef(child.field, name));
        }
        
        if (children.length === 1 && !('children' in children[0])) {
          // Single child that's not a group - don't wrap in unnecessary group
          // But preserve the grouping for clarity
          const colGroup: ColGroupDef = {
            headerName: name,
            headerClass: 'ag-header-group-cell-label',
            children: children,
            marryChildren: true,
          };
          results.push(colGroup);
        } else {
          const colGroup: ColGroupDef = {
            headerName: name,
            headerClass: 'ag-header-group-cell-label',
            children: children,
            marryChildren: true,
          };
          results.push(colGroup);
        }
      }
    }

    return results;
  };

  return convertToColDefs(root);
}

/**
 * Generate flat AG Grid column definitions (without grouping).
 * Use this when you want simple dot-notation headers.
 * 
 * @param flattenedFields - Array of flattened fields
 * @param rowData - The row data (for calculating numeric ranges)
 * @returns Array of AG Grid column definitions
 */
export function generateFlatColumnDefs(
  flattenedFields: FlattenedField[],
  rowData: FlatRow[]
): ColDef[] {
  return flattenedFields.map((field) => {
    const isNumeric = field.schema.type === 'integer' || field.schema.type === 'number';
    const isBoolean = field.schema.type === 'boolean';
    const isArray = field.schema.type === 'array';
    const hasEnum = !!(field.schema.enum || field.schema.literal_values);

    // Calculate min/max for numeric columns
    let minMax: { min: number; max: number } | undefined;
    if (isNumeric && rowData.length > 0) {
      minMax = calculateColumnMinMax(rowData, field.path);
    }

    // Get cell editor configuration
    const editorConfig = getCellEditorForType(field.schema);

    const colDef: ColDef = {
      field: field.path,
      headerName: field.path, // Use full path as header
      headerTooltip: field.schema.description || field.path,
      editable: !field.schema.ui_config?.read_only && !isArray,
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 100,
      flex: 1,
      ...editorConfig,
      // Value getter to handle nested paths
      valueGetter: (params: ValueGetterParams) => {
        return params.data?.[field.path];
      },
      // Value setter to update the row data
      valueSetter: (params: ValueSetterParams) => {
        if (params.data) {
          params.data[field.path] = params.newValue;
          return true;
        }
        return false;
      },
    };

    // Add cell style for numeric columns (color by value)
    if (isNumeric && minMax) {
      const { min, max } = minMax;
      colDef.cellStyle = (params) => {
        const value = params.value;
        if (typeof value !== 'number' || isNaN(value)) {
          return undefined;
        }
        const bgColor = getColorForValue(value, min, max);
        return { backgroundColor: bgColor };
      };
    }

    // Add cell renderer for boolean columns
    if (isBoolean) {
      colDef.cellRenderer = (params: { value: unknown }) => {
        return params.value ? '✓' : '✗';
      };
    }

    // For arrays, show as non-editable summary
    if (isArray) {
      colDef.cellRenderer = (params: { value: unknown }) => {
        if (Array.isArray(params.value)) {
          return `[${params.value.length} items]`;
        }
        return '-';
      };
    }

    // For enum/literal values, ensure proper display
    if (hasEnum) {
      colDef.cellRenderer = (params: { value: unknown }) => {
        return params.value !== undefined && params.value !== null 
          ? String(params.value) 
          : '';
      };
    }

    return colDef;
  });
}

/**
 * Recalculate column styles after data changes.
 * Updates the cell style functions with new min/max values.
 * 
 * @param columnDefs - Current column definitions
 * @param flattenedFields - Flattened schema fields
 * @param rowData - Updated row data
 * @returns Updated column definitions
 */
export function updateColumnDefsWithNewData(
  columnDefs: ColDef[],
  flattenedFields: FlattenedField[],
  rowData: FlatRow[]
): ColDef[] {
  return columnDefs.map((colDef, index) => {
    const field = flattenedFields[index];
    if (!field) return colDef;

    const isNumeric = field.schema.type === 'integer' || field.schema.type === 'number';

    if (isNumeric && rowData.length > 0) {
      const { min, max } = calculateColumnMinMax(rowData, field.path);
      return {
        ...colDef,
        cellStyle: (params) => {
          const value = params.value;
          if (typeof value !== 'number' || isNaN(value)) {
            return undefined;
          }
          const bgColor = getColorForValue(value, min, max);
          return { backgroundColor: bgColor };
        },
      };
    }

    return colDef;
  });
}

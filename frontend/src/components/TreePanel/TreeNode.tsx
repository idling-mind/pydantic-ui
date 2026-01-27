import React from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, List, Hash, ToggleLeft, Type, AlertCircle, Layers } from 'lucide-react';
import { cn, isFieldVisible } from '@/lib/utils';
import { resolveDisplay, resolveArrayItemDisplay } from '@/lib/displayUtils';
import FieldHelp from '@/components/FieldHelp';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ContextMenuTrigger } from '@/components/ui/context-menu';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/context/DataContext';
import { TreeNodeContextMenu } from './TreeNodeContextMenu';
import type { SchemaField, UnionVariant } from '@/types';

interface TreeNodeProps {
  name: string;
  path: string;
  schema: SchemaField;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  showTypes: boolean;
  hideSimpleFields?: boolean;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  // Pass these through for children
  selectedPath: string | null;
  expandedPaths: Set<string>;
  // Error count for this node and its children
  errorCount?: number;
  getErrorCountForPath: (path: string) => number;
  // Is this the root node?
  isRoot?: boolean;
  // Multi-select support
  multiSelectedPaths?: Set<string>;
  onMultiSelect?: (path: string, additive: boolean) => void;
  onMultiPaste?: (paths: string[], data: unknown) => void;
  // For array items - parent array path and index for delete functionality
  parentArrayPath?: string;
  arrayIndex?: number;
  // Search highlighting
  matchedPaths?: Set<string>;
  searchQuery?: string;
}

interface ConnectedTreeNodeProps {
  name: string;
  path: string;
  schema: SchemaField;
  depth: number;
  showTypes: boolean;
  hideSimpleFields?: boolean;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  getErrorCountForPath: (path: string) => number;
  // Is this the root node?
  isRoot?: boolean;
  // Multi-select support
  multiSelectedPaths?: Set<string>;
  onMultiSelect?: (path: string, additive: boolean) => void;
  onMultiPaste?: (paths: string[], data: unknown) => void;
  // Search highlighting
  matchedPaths?: Set<string>;
  searchQuery?: string;
}

// Helper to get value at a path that may include array indices
// e.g., "users[0].address" or "items[1][2].name"
function getValueAtPath(data: unknown, path: string): unknown {
  if (!path || !data) return data;
  
  // Parse the path, handling both dot notation and array index notation
  const pathRegex = /([^.\[\]]+)|\[(\d+)\]/g;
  const parts: { key: string; isIndex: boolean }[] = [];
  let match;
  while ((match = pathRegex.exec(path)) !== null) {
    if (match[1] !== undefined) {
      parts.push({ key: match[1], isIndex: false });
    } else if (match[2] !== undefined) {
      parts.push({ key: match[2], isIndex: true });
    }
  }

  let current: unknown = data;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    
    if (part.isIndex) {
      const index = parseInt(part.key, 10);
      if (Array.isArray(current)) {
        current = current[index];
      } else {
        return undefined;
      }
    } else {
      current = (current as Record<string, unknown>)[part.key];
    }
  }
  
  return current;
}

// Get the label for an array item based on its value and schema
// Uses the unified display resolver with template support
function getArrayItemLabel(item: unknown, index: number, itemSchema?: SchemaField): string {
  if (!itemSchema) {
    return `Item ${index + 1}`;
  }

  // Use the display resolver for array items
  const display = resolveArrayItemDisplay(itemSchema, item, index, 'tree');
  return display.title;
}

function getTypeIcon(type: string, isExpanded: boolean) {
  switch (type) {
    case 'object':
      return isExpanded ? (
        <FolderOpen className="h-4 w-4 text-blue-500" />
      ) : (
        <Folder className="h-4 w-4 text-blue-500" />
      );
    case 'array':
      return <List className="h-4 w-4 text-green-500" />;
    case 'union':
      return <Layers className="h-4 w-4 text-amber-500" />;
    case 'string':
      return <Type className="h-4 w-4 text-orange-500" />;
    case 'integer':
    case 'number':
      return <Hash className="h-4 w-4 text-purple-500" />;
    case 'boolean':
      return <ToggleLeft className="h-4 w-4 text-pink-500" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

function getTypeBadgeVariant(type: string): 'default' | 'secondary' | 'outline' {
  switch (type) {
    case 'object':
    case 'array':
      return 'secondary';
    default:
      return 'outline';
  }
}

// Check if a path represents an array item (ends with [N] pattern)
function isArrayItemPath(path: string): boolean {
  return /\[\d+\]$/.test(path);
}

/**
 * Get the depth of array nesting for a schema.
 * e.g., list[int] -> 1, list[list[int]] -> 2
 */
function getSchemaArrayDepth(schema: SchemaField): number {
  if (schema.type !== 'array') return 0;
  if (!schema.items) return 1;
  return 1 + getSchemaArrayDepth(schema.items);
}

/**
 * Get the innermost (leaf) item type for an array schema.
 * e.g., list[str] -> 'string', list[list[int]] -> 'integer'
 */
function getSchemaLeafItemType(schema: SchemaField): string | null {
  if (schema.type !== 'array') return null;
  if (!schema.items) return null;
  if (schema.items.type === 'array') {
    return getSchemaLeafItemType(schema.items);
  }
  return schema.items.type;
}

/**
 * Get the depth of array nesting for a value.
 * e.g., [] -> 1, [[]] -> 2, [[[]]] -> 3
 */
function getArrayDepth(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  if (value.length === 0) return 1; // Empty array, at least depth 1
  return 1 + getArrayDepth(value[0]);
}

/**
 * Get the innermost (leaf) item type from actual array values.
 * e.g., ["a", "b"] -> 'string', [[1, 2]] -> 'integer', [] -> null
 */
function getValueLeafItemType(value: unknown[]): string | null {
  if (value.length === 0) return null;
  
  // Get the first non-null/undefined item
  const firstItem = value.find(item => item !== null && item !== undefined);
  if (firstItem === undefined) return null;
  
  // If it's a nested array, recurse
  if (Array.isArray(firstItem)) {
    return getValueLeafItemType(firstItem);
  }
  
  // Return the type of the leaf value
  const jsType = typeof firstItem;
  if (jsType === 'string') return 'string';
  if (jsType === 'number') return Number.isInteger(firstItem) ? 'integer' : 'number';
  if (jsType === 'boolean') return 'boolean';
  if (jsType === 'object') return 'object';
  return null;
}

/**
 * Detect which union variant the current value matches.
 * Uses discriminator if available, otherwise tries to match by structure.
 * Returns the variant schema and index, or null if no match.
 * @param storedVariantIndex - Optional stored variant index from user selection
 */
function detectCurrentVariant(
  value: unknown,
  schema: SchemaField,
  storedVariantIndex?: number
): { variant: UnionVariant; index: number } | null {
  const variants = schema.variants;
  if (!variants || variants.length === 0) {
    return null;
  }

  // If we have a stored variant index from user selection, use it
  if (storedVariantIndex !== undefined && storedVariantIndex >= 0 && storedVariantIndex < variants.length) {
    return { variant: variants[storedVariantIndex], index: storedVariantIndex };
  }

  if (value === null || value === undefined) {
    return null;
  }

  // If there's a discriminator, use it to determine the variant
  const discriminator = schema.discriminator;
  if (discriminator?.field && discriminator.mapping) {
    if (typeof value === 'object' && !Array.isArray(value)) {
      const discValue = (value as Record<string, unknown>)[discriminator.field];
      if (discValue !== undefined) {
        const variantIndex = discriminator.mapping[String(discValue)];
        if (variantIndex !== undefined && variants[variantIndex]) {
          return { variant: variants[variantIndex], index: variantIndex };
        }
      }
    }
  }

  // Try to detect by type matching
  if (typeof value === 'object' && !Array.isArray(value)) {
    // For objects, find the best match by field overlap
    const valueKeys = Object.keys(value as Record<string, unknown>);
    const objectVariants = variants
      .map((v, i) => ({ variant: v, index: i }))
      .filter(({ variant }) => variant.type === 'object' && variant.fields);

    if (objectVariants.length === 1) {
      return objectVariants[0];
    }

    // Score each variant by how well its fields match the value's keys
    let bestMatch: { variant: UnionVariant; index: number } | null = null;
    let bestScore = -Infinity;

    for (const { variant, index } of objectVariants) {
      const variantKeys = Object.keys(variant.fields!);
      
      // Count matching keys (keys that exist in both)
      const matchingKeys = valueKeys.filter(k => variantKeys.includes(k)).length;
      
      // Count extra keys in value that don't exist in variant (penalty)
      const extraKeys = valueKeys.filter(k => !variantKeys.includes(k)).length;
      
      // Count missing keys from variant that should be in value
      const missingKeys = variantKeys.filter(k => !valueKeys.includes(k)).length;
      
      // Score: matching keys minus penalties for extra/missing keys
      const score = matchingKeys * 2 - extraKeys - missingKeys;
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { variant, index };
      }
    }

    if (bestMatch) {
      return bestMatch;
    }
  }

  // For arrays, match by depth AND item type to distinguish list[int] from list[str]
  if (Array.isArray(value)) {
    const valueDepth = getArrayDepth(value);
    const valueLeafType = getValueLeafItemType(value);
    
    // Find all array variants and their depths/item types
    const arrayVariants = variants
      .map((v, idx) => ({ 
        variant: v, 
        index: idx, 
        depth: getSchemaArrayDepth(v),
        leafType: getSchemaLeafItemType(v)
      }))
      .filter(v => v.variant.type === 'array');
    
    // If we have items in the array, try to match both depth and item type
    if (valueLeafType !== null) {
      // First try exact match on both depth and item type
      const exactMatch = arrayVariants.find(v => 
        v.depth === valueDepth && v.leafType === valueLeafType
      );
      if (exactMatch) {
        return { variant: exactMatch.variant, index: exactMatch.index };
      }
      
      // Try matching item type with compatible depth (integer matches number)
      const typeMatch = arrayVariants.find(v => {
        if (v.depth !== valueDepth) return false;
        if (v.leafType === valueLeafType) return true;
        // integer values can match number schema
        if (valueLeafType === 'integer' && v.leafType === 'number') return true;
        return false;
      });
      if (typeMatch) {
        return { variant: typeMatch.variant, index: typeMatch.index };
      }
    }
    
    // For empty arrays or when no type match, try depth match first
    const depthMatch = arrayVariants.find(v => v.depth === valueDepth);
    if (depthMatch) {
      return { variant: depthMatch.variant, index: depthMatch.index };
    }
    
    // If no exact match (e.g., empty array), prefer the shallowest array variant
    if (arrayVariants.length > 0) {
      arrayVariants.sort((a, b) => a.depth - b.depth);
      return { variant: arrayVariants[0].variant, index: arrayVariants[0].index };
    }
  }

  // For primitive values, match by type
  const valueType = typeof value;
  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    if (
      (valueType === 'string' && variant.type === 'string') ||
      (valueType === 'number' && (variant.type === 'integer' || variant.type === 'number')) ||
      (valueType === 'boolean' && variant.type === 'boolean')
    ) {
      return { variant: variants[i], index: i };
    }
  }

  return null;
}

/**
 * Get the variant label for display in the tree.
 * Priority: ui_config.display.title > discriminator values > python_type > variant_name
 */
function getVariantLabel(variant: UnionVariant): string {
  // Check for display config title first (from class_configs or attr_configs)
  if (variant.ui_config?.display?.title) {
    return variant.ui_config.display.title;
  }
  // Prefer discriminator values (e.g., "cat", "dog")
  if (variant.discriminator_values && variant.discriminator_values.length > 0) {
    return String(variant.discriminator_values[0]);
  }
  // For arrays and primitives, python_type provides more useful info (e.g., 'list[str]' vs 'list')
  if (variant.type === 'array' || ['string', 'integer', 'number', 'boolean'].includes(variant.type)) {
    if (variant.python_type) {
      return variant.python_type;
    }
  }
  // Fall back to variant name (e.g., "Cat", "Dog")
  return variant.variant_name || variant.title || `Variant ${variant.variant_index + 1}`;
}

/**
 * Check if a union has any expandable variants (objects or arrays).
 */
function unionHasExpandableVariants(schema: SchemaField): boolean {
  if (!schema.variants) return false;
  return schema.variants.some(v => 
    v.type === 'object' && v.fields && Object.keys(v.fields).length > 0 ||
    v.type === 'array'
  );
}

// Get the display label for a node
// For array items, prefer the computed name from data (e.g., "Weld A")
// For regular fields, use the unified display resolver
function getNodeLabel(name: string, schema: SchemaField, path: string, fieldData?: unknown): string {
  // For array items, the 'name' prop already contains the computed label from getArrayItemLabel
  // which uses the display resolver with template support.
  if (isArrayItemPath(path)) {
    return name;
  }
  // For regular fields, use the display resolver for tree view
  // Pass the field data to enable template resolution for complex objects
  const display = resolveDisplay({ 
    schema, 
    view: 'tree', 
    name, 
    data: fieldData 
  });
  return display.title;
}

export function TreeNode({
  name,
  path,
  schema,
  depth,
  isSelected,
  isExpanded,
  showTypes,
  hideSimpleFields = false,
  onSelect,
  onToggle,
  selectedPath,
  expandedPaths,
  errorCount = 0,
  getErrorCountForPath,
  isRoot = false,
  multiSelectedPaths = new Set(),
  onMultiSelect,
  onMultiPaste,
  parentArrayPath,
  arrayIndex,
  matchedPaths,
  searchQuery,
}: TreeNodeProps) {
  const { data, variantSelections } = useData();
  
  // Check if this node is a direct match (not just a parent of a match)
  const isDirectMatch = matchedPaths && searchQuery && matchedPaths.has(path);
  
  // Helper to highlight matched text
  const highlightText = (text: string): React.ReactNode => {
    if (!searchQuery || !isDirectMatch) {
      return text;
    }
    
    const lowerText = text.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    
    if (index === -1) {
      return text;
    }
    
    const before = text.slice(0, index);
    const match = text.slice(index, index + searchQuery.length);
    const after = text.slice(index + searchQuery.length);
    
    return (
      <>
        {before}
        <mark className="bg-yellow-300 dark:bg-yellow-600 font-medium px-0.5 rounded">
          {match}
        </mark>
        {highlightText(after)}
      </>
    );
  };
  const isArray = schema.type === 'array';
  const isUnion = schema.type === 'union' && schema.variants;
  
  // Get the current value at this path for union variant detection
  const currentNodeValue = React.useMemo(() => {
    return getValueAtPath(data, path);
  }, [data, path]);
  
  // Get stored variant index for this path if any
  const storedVariantIndex = variantSelections.get(path);
  
  // Detect the active union variant if this is a union
  const detectedVariant = React.useMemo(() => {
    if (!isUnion) return null;
    return detectCurrentVariant(currentNodeValue, schema, storedVariantIndex);
  }, [isUnion, currentNodeValue, schema, storedVariantIndex]);
  
  // Determine if this node is expandable
  // - Objects with fields are expandable
  // - Arrays are expandable
  // - Unions with a detected object/array variant are expandable
  const isExpandable = React.useMemo(() => {
    if (schema.type === 'object' || schema.type === 'array') {
      return true;
    }
    if (isUnion && detectedVariant) {
      // Union is expandable if the detected variant is an object with fields or an array
      const v = detectedVariant.variant;
      return (v.type === 'object' && v.fields && Object.keys(v.fields).length > 0) ||
             v.type === 'array';
    }
    // Union without data but has expandable variants - show as expandable to indicate potential
    if (isUnion && unionHasExpandableVariants(schema)) {
      return true;
    }
    return false;
  }, [schema, isUnion, detectedVariant]);
  
  const isMultiSelected = multiSelectedPaths.has(path);

  // Get array data for this path if it's an array
  const arrayData = React.useMemo(() => {
    if (!isArray) return undefined;
    return getValueAtPath(data, path);
  }, [isArray, data, path]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Ctrl/Cmd+click for multi-select
    if ((e.ctrlKey || e.metaKey) && onMultiSelect) {
      onMultiSelect(path, true);
    } else {
      onSelect(path);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExpandable) {
      onToggle(path);
    }
  };

  const getChildren = (): [string, SchemaField][] => {
    if (schema.type === 'object' && schema.fields) {
      // Get value at current path for filtering optional fields
      const currentValue = getValueAtPath(data, path);
      
      return Object.entries(schema.fields).filter(
        ([fieldName, field]) => {
          // Filter out simple fields if hideSimpleFields is enabled
          if (hideSimpleFields && field.type !== 'object' && field.type !== 'array' && field.type !== 'union') {
            return false;
          }
          
          // Check visibility based on hidden and visible_when conditions
          const fieldValue = currentValue && typeof currentValue === 'object' 
            ? (currentValue as Record<string, unknown>)[fieldName]
            : undefined;
          if (!isFieldVisible(field, data || {}, fieldValue)) {
            return false;
          }
          
          // For optional fields without visible_when, only show if they have a value
          if (field.required === false && !field.ui_config?.visible_when) {
            if (fieldValue === null || fieldValue === undefined) {
              return false;
            }
          }
          return true;
        }
      );
    }
    
    // For unions with a detected variant, return the variant's fields
    if (isUnion && detectedVariant) {
      const variant = detectedVariant.variant;
      if (variant.type === 'object' && variant.fields) {
        return Object.entries(variant.fields).filter(
          ([fieldName, field]) => {
            // Filter out simple fields if hideSimpleFields is enabled
            if (hideSimpleFields && field.type !== 'object' && field.type !== 'array' && field.type !== 'union') {
              return false;
            }
            
            // Check visibility based on hidden and visible_when conditions
            const fieldValue = currentNodeValue && typeof currentNodeValue === 'object' 
              ? (currentNodeValue as Record<string, unknown>)[fieldName]
              : undefined;
            if (!isFieldVisible(field, data || {}, fieldValue)) {
              return false;
            }
            
            return true;
          }
        );
      }
    }
    
    // For arrays, we don't return schema children here anymore
    // Array items will be rendered separately
    return [];
  };

  const children = getChildren();
  
  // For unions with a detected array variant, get the array data
  const unionArrayData = React.useMemo(() => {
    if (!isUnion || !detectedVariant) return undefined;
    if (detectedVariant.variant.type === 'array') {
      return currentNodeValue;
    }
    return undefined;
  }, [isUnion, detectedVariant, currentNodeValue]);
  
  const hasChildren = children.length > 0 || 
    (isArray && Array.isArray(arrayData) && arrayData.length > 0) ||
    (isUnion && detectedVariant !== null) ||
    (isUnion && Array.isArray(unionArrayData) && unionArrayData.length > 0);

  // Get list of selected paths for context menu (multi-select or single)
  const selectedPathsForMenu = React.useMemo(() => {
    if (multiSelectedPaths.size > 0) {
      return Array.from(multiSelectedPaths);
    }
    return [path];
  }, [multiSelectedPaths, path]);

  const nodeContentInner = (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-md text-sm',
        'hover:bg-accent hover:text-accent-foreground',
        'transition-colors duration-150',
        isSelected && 'bg-accent text-accent-foreground font-medium',
        isMultiSelected && 'ring-2 ring-primary ring-inset',
        errorCount > 0 && 'text-destructive'
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={handleClick}
    >
      {isExpandable && hasChildren ? (
        <button
          onClick={handleToggle}
          className="p-0.5 hover:bg-muted rounded shrink-0"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <span className="shrink-0">{getTypeIcon(schema.type, isExpanded)}</span>
      <span className="truncate flex-1 flex items-center gap-2">
        <span className="truncate flex-1">{highlightText(getNodeLabel(name, schema, path, currentNodeValue))}</span>
        {resolveDisplay({ schema, view: 'tree', name, data: currentNodeValue }).helpText && (
          <FieldHelp helpText={resolveDisplay({ schema, view: 'tree', name, data: currentNodeValue }).helpText!} />
        )}
      </span>
      {/* Show detected variant badge for unions */}
      {isUnion && detectedVariant && (
        <Badge 
          variant="default" 
          className="text-[10px] px-1.5 py-0 h-5 shrink-0 bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30"
        >
          {getVariantLabel(detectedVariant.variant)}
        </Badge>
      )}
      {errorCount > 0 && (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 shrink-0 flex items-center gap-0.5">
          <AlertCircle className="h-3 w-3" />
          {errorCount}
        </Badge>
      )}
      {showTypes && (
        <Badge 
          variant={getTypeBadgeVariant(schema.type)} 
          className="text-[10px] px-1.5 py-0 h-5 shrink-0 max-w-[120px] truncate"
          title={schema.python_type || schema.type}
        >
          {schema.python_type || schema.type}
        </Badge>
      )}
      {schema.required === false && (
        <span className="text-[10px] text-muted-foreground shrink-0">optional</span>
      )}
    </div>
  );

  const nodeContent = (
    <TreeNodeContextMenu
      path={path}
      schema={schema}
      nodeName={name}
      selectedPaths={selectedPathsForMenu}
      onMultiPaste={onMultiPaste}
      parentArrayPath={parentArrayPath}
      arrayIndex={arrayIndex}
    >
      <ContextMenuTrigger asChild>
        {nodeContentInner}
      </ContextMenuTrigger>
    </TreeNodeContextMenu>
  );

  if (!isExpandable || !hasChildren) {
    return nodeContent;
  }

  // For root node, only render the toggle-able content without nested children
  // (children are rendered separately in TreePanel/index.tsx)
  if (isRoot) {
    const rootNodeContent = (
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-md text-sm',
          'hover:bg-accent hover:text-accent-foreground',
          'transition-colors duration-150',
          isSelected && 'bg-accent text-accent-foreground font-medium',
          isMultiSelected && 'ring-2 ring-primary ring-inset',
          errorCount > 0 && 'text-destructive'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        <button
          onClick={handleToggle}
          className="p-0.5 hover:bg-muted rounded shrink-0"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <span className="shrink-0">{getTypeIcon(schema.type, isExpanded)}</span>
        <span className="truncate flex-1">{highlightText(getNodeLabel(name, schema, path, currentNodeValue))}</span>
        {/* Show detected variant badge for unions */}
        {isUnion && detectedVariant && (
          <Badge 
            variant="default" 
            className="text-[10px] px-1.5 py-0 h-5 shrink-0 bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30"
          >
            {getVariantLabel(detectedVariant.variant)}
          </Badge>
        )}
        {errorCount > 0 && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 shrink-0 flex items-center gap-0.5">
            <AlertCircle className="h-3 w-3" />
            {errorCount}
          </Badge>
        )}
        {showTypes && (
          <Badge 
            variant={getTypeBadgeVariant(schema.type)} 
            className="text-[10px] px-1.5 py-0 h-5 shrink-0 max-w-[120px] truncate"
            title={schema.python_type || schema.type}
          >
            {schema.python_type || schema.type}
          </Badge>
        )}
      </div>
    );

    return (
      <TreeNodeContextMenu
        path={path}
        schema={schema}
        nodeName={name}
        selectedPaths={selectedPathsForMenu}
        onMultiPaste={onMultiPaste}
        parentArrayPath={parentArrayPath}
        arrayIndex={arrayIndex}
      >
        <ContextMenuTrigger asChild>
          {rootNodeContent}
        </ContextMenuTrigger>
      </TreeNodeContextMenu>
    );
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={() => onToggle(path)}>
      <CollapsibleTrigger asChild>{nodeContent}</CollapsibleTrigger>
      <CollapsibleContent>
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 w-px bg-border"
            style={{ left: `${depth * 16 + 18}px` }}
          />
          {/* Render object children (including union variant fields) */}
          {children
            .filter(([childName]) => {
              // If searching, only show children that are in matchedPaths
              if (searchQuery && matchedPaths && matchedPaths.size > 0) {
                const childPath = `${path}.${childName}`;
                return matchedPaths.has(childPath);
              }
              return true;
            })
            .map(([childName, childSchema]) => {
            const childPath = `${path}.${childName}`;
            const childErrorCount = getErrorCountForPath(childPath);
            return (
              <TreeNode
                key={childPath}
                name={childName}
                path={childPath}
                schema={childSchema}
                depth={depth + 1}
                isSelected={selectedPath === childPath}
                isExpanded={expandedPaths.has(childPath)}
                showTypes={showTypes}
                hideSimpleFields={hideSimpleFields}
                onSelect={onSelect}
                onToggle={onToggle}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                errorCount={childErrorCount}
                getErrorCountForPath={getErrorCountForPath}
                multiSelectedPaths={multiSelectedPaths}
                onMultiSelect={onMultiSelect}
                onMultiPaste={onMultiPaste}
                matchedPaths={matchedPaths}
                searchQuery={searchQuery}
              />
            );
          })}
          {/* Render array items as sub-nodes */}
          {isArray && Array.isArray(arrayData) && arrayData
            .map((item, index) => ({ item, index }))
            .filter(({ index }) => {
              // If searching, only show array items that are in matchedPaths
              if (searchQuery && matchedPaths && matchedPaths.size > 0) {
                const itemPath = `${path}[${index}]`;
                return matchedPaths.has(itemPath);
              }
              return true;
            })
            .map(({ item, index }) => {
            const itemPath = `${path}[${index}]`;
            const itemSchema = schema.items || { type: 'object' };
            const itemLabel = getArrayItemLabel(item, index, itemSchema);
            const itemErrorCount = getErrorCountForPath(itemPath);
            
            // Check if this array item has nested content (object, array, or union)
            const itemIsExpandable = itemSchema.type === 'object' || 
                                     itemSchema.type === 'array' ||
                                     (itemSchema.type === 'union' && itemSchema.variants);
            
            if (itemIsExpandable && itemSchema.type === 'object' && itemSchema.fields) {
              // Render as expandable node for objects
              return (
                <TreeNode
                  key={itemPath}
                  name={itemLabel}
                  path={itemPath}
                  schema={itemSchema}
                  depth={depth + 1}
                  isSelected={selectedPath === itemPath}
                  isExpanded={expandedPaths.has(itemPath)}
                  showTypes={showTypes}
                  hideSimpleFields={hideSimpleFields}
                  onSelect={onSelect}
                  onToggle={onToggle}
                  selectedPath={selectedPath}
                  expandedPaths={expandedPaths}
                  errorCount={itemErrorCount}
                  getErrorCountForPath={getErrorCountForPath}
                  multiSelectedPaths={multiSelectedPaths}
                  onMultiSelect={onMultiSelect}
                  onMultiPaste={onMultiPaste}
                  parentArrayPath={path}
                  arrayIndex={index}
                  matchedPaths={matchedPaths}
                  searchQuery={searchQuery}
                />
              );
            }
            
            // Render union items - they can be expanded to show their variant's content
            if (itemSchema.type === 'union' && itemSchema.variants) {
              // Detect the variant for this specific item, using stored variant if available
              const itemPath = `${path}[${index}]`;
              const itemStoredVariant = variantSelections.get(itemPath);
              const itemVariant = detectCurrentVariant(item, itemSchema, itemStoredVariant);
              // Get a better label from the detected variant
              const unionItemLabel = itemVariant 
                ? getArrayItemLabel(item, index, itemVariant.variant)
                : getArrayItemLabel(item, index, itemSchema);
              
              return (
                <UnionArrayItemNode
                  key={itemPath}
                  name={unionItemLabel}
                  path={itemPath}
                  schema={itemSchema}
                  item={item}
                  depth={depth + 1}
                  isSelected={selectedPath === itemPath}
                  isExpanded={expandedPaths.has(itemPath)}
                  showTypes={showTypes}
                  hideSimpleFields={hideSimpleFields}
                  onSelect={onSelect}
                  onToggle={onToggle}
                  selectedPath={selectedPath}
                  expandedPaths={expandedPaths}
                  errorCount={itemErrorCount}
                  getErrorCountForPath={getErrorCountForPath}
                  multiSelectedPaths={multiSelectedPaths}
                  onMultiSelect={onMultiSelect}
                  onMultiPaste={onMultiPaste}
                  parentArrayPath={path}
                  arrayIndex={index}
                  matchedPaths={matchedPaths}
                  searchQuery={searchQuery}
                />
              );
            }
            
            // Skip primitive array items when hideSimpleFields is enabled
            if (hideSimpleFields && !itemIsExpandable) {
              return null;
            }
            
            // Render as leaf node for primitives
            return (
              <ArrayItemNode
                key={itemPath}
                label={itemLabel}
                path={itemPath}
                schema={itemSchema}
                depth={depth + 1}
                isSelected={selectedPath === itemPath}
                isMultiSelected={multiSelectedPaths.has(itemPath)}
                showTypes={showTypes}
                itemType={itemSchema.type}
                onSelect={onSelect}
                onMultiSelect={onMultiSelect}
                errorCount={itemErrorCount}
                multiSelectedPaths={multiSelectedPaths}
                onMultiPaste={onMultiPaste}
                parentArrayPath={path}
                arrayIndex={index}
              />
            );
          })}
          {/* Render union array variant items (when this union's detected variant is an array) */}
          {isUnion && detectedVariant && detectedVariant.variant.type === 'array' && 
           Array.isArray(unionArrayData) && unionArrayData.map((item, index) => {
            const itemPath = `${path}[${index}]`;
            const variantItemSchema = detectedVariant.variant.items || { type: 'object' };
            const itemLabel = getArrayItemLabel(item, index, variantItemSchema);
            const itemErrorCount = getErrorCountForPath(itemPath);
            
            // Check if this array item has nested content
            const itemIsExpandable = variantItemSchema.type === 'object' || 
                                     variantItemSchema.type === 'array' ||
                                     (variantItemSchema.type === 'union' && variantItemSchema.variants);
            
            if (itemIsExpandable) {
              return (
                <TreeNode
                  key={itemPath}
                  name={itemLabel}
                  path={itemPath}
                  schema={variantItemSchema}
                  depth={depth + 1}
                  isSelected={selectedPath === itemPath}
                  isExpanded={expandedPaths.has(itemPath)}
                  showTypes={showTypes}
                  hideSimpleFields={hideSimpleFields}
                  onSelect={onSelect}
                  onToggle={onToggle}
                  selectedPath={selectedPath}
                  expandedPaths={expandedPaths}
                  errorCount={itemErrorCount}
                  getErrorCountForPath={getErrorCountForPath}
                  multiSelectedPaths={multiSelectedPaths}
                  onMultiSelect={onMultiSelect}
                  onMultiPaste={onMultiPaste}
                  parentArrayPath={path}
                  arrayIndex={index}
                />
              );
            }
            
            // Skip primitive array items when hideSimpleFields is enabled
            if (hideSimpleFields) {
              return null;
            }
            
            // Render as leaf node for primitives
            return (
              <ArrayItemNode
                key={itemPath}
                label={itemLabel}
                path={itemPath}
                schema={variantItemSchema}
                depth={depth + 1}
                isSelected={selectedPath === itemPath}
                isMultiSelected={multiSelectedPaths.has(itemPath)}
                showTypes={showTypes}
                itemType={variantItemSchema.type}
                onSelect={onSelect}
                onMultiSelect={onMultiSelect}
                errorCount={itemErrorCount}
                multiSelectedPaths={multiSelectedPaths}
                onMultiPaste={onMultiPaste}
                parentArrayPath={path}
                arrayIndex={index}
              />
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Simple leaf node for array items (primitives)
interface ArrayItemNodeProps {
  label: string;
  path: string;
  schema: SchemaField;
  depth: number;
  isSelected: boolean;
  isMultiSelected: boolean;
  showTypes: boolean;
  itemType: string;
  onSelect: (path: string) => void;
  onMultiSelect?: (path: string, additive: boolean) => void;
  errorCount?: number;
  multiSelectedPaths?: Set<string>;
  onMultiPaste?: (paths: string[], data: unknown) => void;
  // For delete functionality
  parentArrayPath?: string;
  arrayIndex?: number;
}

function ArrayItemNode({
  label,
  path,
  schema,
  depth,
  isSelected,
  isMultiSelected,
  showTypes,
  itemType,
  onSelect,
  onMultiSelect,
  errorCount = 0,
  multiSelectedPaths = new Set(),
  onMultiPaste,
  parentArrayPath,
  arrayIndex,
}: ArrayItemNodeProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Ctrl/Cmd+click for multi-select
    if ((e.ctrlKey || e.metaKey) && onMultiSelect) {
      onMultiSelect(path, true);
    } else {
      onSelect(path);
    }
  };

  // Get list of selected paths for context menu
  const selectedPathsForMenu = React.useMemo(() => {
    if (multiSelectedPaths.size > 0) {
      return Array.from(multiSelectedPaths);
    }
    return [path];
  }, [multiSelectedPaths, path]);

  const nodeContent = (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-md text-sm',
        'hover:bg-accent hover:text-accent-foreground',
        'transition-colors duration-150',
        isSelected && 'bg-accent text-accent-foreground font-medium',
        isMultiSelected && 'ring-2 ring-primary ring-inset',
        errorCount > 0 && 'text-destructive'
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={handleClick}
    >
      <span className="w-5 shrink-0" />
      <span className="shrink-0">{getTypeIcon(itemType, false)}</span>
      <span className="truncate flex-1">{label}</span>
      {errorCount > 0 && (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 shrink-0 flex items-center gap-0.5">
          <AlertCircle className="h-3 w-3" />
          {errorCount}
        </Badge>
      )}
      {showTypes && (
        <Badge 
          variant="outline" 
          className="text-[10px] px-1.5 py-0 h-5 shrink-0 max-w-[120px] truncate"
          title={schema.python_type || itemType}
        >
          {schema.python_type || itemType}
        </Badge>
      )}
    </div>
  );

  return (
    <TreeNodeContextMenu
      path={path}
      schema={schema}
      nodeName={label}
      selectedPaths={selectedPathsForMenu}
      onMultiPaste={onMultiPaste}
      parentArrayPath={parentArrayPath}
      arrayIndex={arrayIndex}
    >
      <ContextMenuTrigger asChild>
        {nodeContent}
      </ContextMenuTrigger>
    </TreeNodeContextMenu>
  );
}

/**
 * Union array item node - renders a union item within an array.
 * This node is expandable if the detected variant is an object or array.
 */
interface UnionArrayItemNodeProps {
  name: string;
  path: string;
  schema: SchemaField;  // The union schema
  item: unknown;        // The actual item data
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  showTypes: boolean;
  hideSimpleFields?: boolean;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  errorCount?: number;
  getErrorCountForPath: (path: string) => number;
  multiSelectedPaths?: Set<string>;
  onMultiSelect?: (path: string, additive: boolean) => void;
  onMultiPaste?: (paths: string[], data: unknown) => void;
  parentArrayPath?: string;
  arrayIndex?: number;
  // Search highlighting
  matchedPaths?: Set<string>;
  searchQuery?: string;
}

function UnionArrayItemNode({
  name,
  path,
  schema,
  item,
  depth,
  isSelected,
  isExpanded,
  showTypes,
  hideSimpleFields = false,
  onSelect,
  onToggle,
  selectedPath,
  expandedPaths,
  errorCount = 0,
  getErrorCountForPath,
  multiSelectedPaths = new Set(),
  onMultiSelect,
  onMultiPaste,
  parentArrayPath,
  arrayIndex,
  matchedPaths,
  searchQuery,
}: UnionArrayItemNodeProps) {
  const { data, variantSelections } = useData();
  const isMultiSelected = multiSelectedPaths.has(path);
  
  // Get stored variant index for this path if any
  const storedVariantIndex = variantSelections.get(path);
  
  // Detect the variant for this union item
  const detectedVariant = React.useMemo(() => {
    return detectCurrentVariant(item, schema, storedVariantIndex);
  }, [item, schema, storedVariantIndex]);
  
  // Is this union item expandable?
  const isExpandable = React.useMemo(() => {
    if (!detectedVariant) return false;
    const v = detectedVariant.variant;
    return (v.type === 'object' && v.fields && Object.keys(v.fields).length > 0) ||
           v.type === 'array';
  }, [detectedVariant]);
  
  // Get children based on the detected variant
  const getChildren = (): [string, SchemaField][] => {
    if (!detectedVariant) return [];
    const variant = detectedVariant.variant;
    if (variant.type === 'object' && variant.fields) {
      return Object.entries(variant.fields).filter(
        ([fieldName, field]) => {
          // Filter out simple fields if hideSimpleFields is enabled
          if (hideSimpleFields && field.type !== 'object' && field.type !== 'array' && field.type !== 'union') {
            return false;
          }
          
          // Check visibility
          const fieldValue = item && typeof item === 'object' 
            ? (item as Record<string, unknown>)[fieldName]
            : undefined;
          if (!isFieldVisible(field, data || {}, fieldValue)) {
            return false;
          }
          
          return true;
        }
      );
    }
    return [];
  };
  
  const children = getChildren();
  
  // For union items with array variants, get the array data
  const variantArrayData = React.useMemo(() => {
    if (!detectedVariant || detectedVariant.variant.type !== 'array') return undefined;
    return item;  // The item itself is the array
  }, [detectedVariant, item]);
  
  const hasChildren = children.length > 0 || 
    (detectedVariant?.variant.type === 'array' && Array.isArray(variantArrayData) && (variantArrayData as unknown[]).length > 0);
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((e.ctrlKey || e.metaKey) && onMultiSelect) {
      onMultiSelect(path, true);
    } else {
      onSelect(path);
    }
  };
  
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExpandable && hasChildren) {
      onToggle(path);
    }
  };
  
  const selectedPathsForMenu = React.useMemo(() => {
    if (multiSelectedPaths.size > 0) {
      return Array.from(multiSelectedPaths);
    }
    return [path];
  }, [multiSelectedPaths, path]);
  
  const nodeContentInner = (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-md text-sm',
        'hover:bg-accent hover:text-accent-foreground',
        'transition-colors duration-150',
        isSelected && 'bg-accent text-accent-foreground font-medium',
        isMultiSelected && 'ring-2 ring-primary ring-inset',
        errorCount > 0 && 'text-destructive'
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={handleClick}
    >
      {isExpandable && hasChildren ? (
        <button
          onClick={handleToggle}
          className="p-0.5 hover:bg-muted rounded shrink-0"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <span className="shrink-0">{getTypeIcon('union', isExpanded)}</span>
      <span className="truncate flex-1">{name}</span>
      {/* Show detected variant badge */}
      {detectedVariant && (
        <Badge 
          variant="default" 
          className="text-[10px] px-1.5 py-0 h-5 shrink-0 bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30"
        >
          {getVariantLabel(detectedVariant.variant)}
        </Badge>
      )}
      {errorCount > 0 && (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 shrink-0 flex items-center gap-0.5">
          <AlertCircle className="h-3 w-3" />
          {errorCount}
        </Badge>
      )}
      {showTypes && (
        <Badge 
          variant="outline" 
          className="text-[10px] px-1.5 py-0 h-5 shrink-0 max-w-[120px] truncate"
          title={schema.python_type || 'union'}
        >
          {schema.python_type || 'union'}
        </Badge>
      )}
    </div>
  );
  
  const nodeContent = (
    <TreeNodeContextMenu
      path={path}
      schema={schema}
      nodeName={name}
      selectedPaths={selectedPathsForMenu}
      onMultiPaste={onMultiPaste}
      parentArrayPath={parentArrayPath}
      arrayIndex={arrayIndex}
    >
      <ContextMenuTrigger asChild>
        {nodeContentInner}
      </ContextMenuTrigger>
    </TreeNodeContextMenu>
  );
  
  // If not expandable or no children, return just the node
  if (!isExpandable || !hasChildren) {
    return nodeContent;
  }
  
  return (
    <Collapsible open={isExpanded} onOpenChange={() => onToggle(path)}>
      <CollapsibleTrigger asChild>{nodeContent}</CollapsibleTrigger>
      <CollapsibleContent>
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 w-px bg-border"
            style={{ left: `${depth * 16 + 18}px` }}
          />
          {/* Render union variant's object children */}
          {children
            .filter(([childName]) => {
              // If searching, only show children that are in matchedPaths
              if (searchQuery && matchedPaths && matchedPaths.size > 0) {
                const childPath = `${path}.${childName}`;
                return matchedPaths.has(childPath);
              }
              return true;
            })
            .map(([childName, childSchema]) => {
            const childPath = `${path}.${childName}`;
            const childErrorCount = getErrorCountForPath(childPath);
            return (
              <TreeNode
                key={childPath}
                name={childName}
                path={childPath}
                schema={childSchema}
                depth={depth + 1}
                isSelected={selectedPath === childPath}
                isExpanded={expandedPaths.has(childPath)}
                showTypes={showTypes}
                hideSimpleFields={hideSimpleFields}
                onSelect={onSelect}
                onToggle={onToggle}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                errorCount={childErrorCount}
                getErrorCountForPath={getErrorCountForPath}
                multiSelectedPaths={multiSelectedPaths}
                onMultiSelect={onMultiSelect}
                onMultiPaste={onMultiPaste}
                matchedPaths={matchedPaths}
                searchQuery={searchQuery}
              />
            );
          })}
          {/* Render union variant's array items */}
          {detectedVariant?.variant.type === 'array' && 
           Array.isArray(variantArrayData) && (variantArrayData as unknown[])
            .map((arrayItem, index) => ({ arrayItem, index }))
            .filter(({ index }) => {
              // If searching, only show array items that are in matchedPaths
              if (searchQuery && matchedPaths && matchedPaths.size > 0) {
                const itemPath = `${path}[${index}]`;
                return matchedPaths.has(itemPath);
              }
              return true;
            })
            .map(({ arrayItem, index }) => {
            const itemPath = `${path}[${index}]`;
            const variantItemSchema = detectedVariant.variant.items || { type: 'object' };
            const itemLabel = getArrayItemLabel(arrayItem, index, variantItemSchema);
            const itemErrorCount = getErrorCountForPath(itemPath);
            
            const itemIsExpandable = variantItemSchema.type === 'object' || 
                                     variantItemSchema.type === 'array' ||
                                     (variantItemSchema.type === 'union' && variantItemSchema.variants);
            
            if (itemIsExpandable) {
              return (
                <TreeNode
                  key={itemPath}
                  name={itemLabel}
                  path={itemPath}
                  schema={variantItemSchema}
                  depth={depth + 1}
                  isSelected={selectedPath === itemPath}
                  isExpanded={expandedPaths.has(itemPath)}
                  showTypes={showTypes}
                  hideSimpleFields={hideSimpleFields}
                  onSelect={onSelect}
                  onToggle={onToggle}
                  selectedPath={selectedPath}
                  expandedPaths={expandedPaths}
                  errorCount={itemErrorCount}
                  getErrorCountForPath={getErrorCountForPath}
                  multiSelectedPaths={multiSelectedPaths}
                  onMultiSelect={onMultiSelect}
                  onMultiPaste={onMultiPaste}
                  parentArrayPath={path}
                  arrayIndex={index}
                  matchedPaths={matchedPaths}
                  searchQuery={searchQuery}
                />
              );
            }
            
            // Skip primitives if hideSimpleFields is enabled
            if (hideSimpleFields) {
              return null;
            }
            
            return (
              <ArrayItemNode
                key={itemPath}
                label={itemLabel}
                path={itemPath}
                schema={variantItemSchema}
                depth={depth + 1}
                isSelected={selectedPath === itemPath}
                isMultiSelected={multiSelectedPaths.has(itemPath)}
                showTypes={showTypes}
                itemType={variantItemSchema.type}
                onSelect={onSelect}
                onMultiSelect={onMultiSelect}
                errorCount={itemErrorCount}
                multiSelectedPaths={multiSelectedPaths}
                onMultiPaste={onMultiPaste}
                parentArrayPath={path}
                arrayIndex={index}
              />
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// A wrapper that computes isSelected and isExpanded from the context props
export function ConnectedTreeNode({
  name,
  path,
  schema,
  depth,
  showTypes,
  hideSimpleFields = false,
  selectedPath,
  expandedPaths,
  onSelect,
  onToggle,
  getErrorCountForPath,
  isRoot = false,
  multiSelectedPaths = new Set(),
  onMultiSelect,
  onMultiPaste,
  matchedPaths,
  searchQuery,
}: ConnectedTreeNodeProps) {
  const errorCount = getErrorCountForPath(path);
  
  return (
    <TreeNode
      name={name}
      path={path}
      schema={schema}
      depth={depth}
      isSelected={selectedPath === path}
      isExpanded={expandedPaths.has(path)}
      showTypes={showTypes}
      hideSimpleFields={hideSimpleFields}
      onSelect={onSelect}
      onToggle={onToggle}
      selectedPath={selectedPath}
      expandedPaths={expandedPaths}
      errorCount={errorCount}
      getErrorCountForPath={getErrorCountForPath}
      isRoot={isRoot}
      multiSelectedPaths={multiSelectedPaths}
      onMultiSelect={onMultiSelect}
      onMultiPaste={onMultiPaste}
      matchedPaths={matchedPaths}
      searchQuery={searchQuery}
    />
  );
}

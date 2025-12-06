import React from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, ChevronRight, Folder, Copy, AlertCircle, List, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FieldRenderer } from '@/components/Renderers';
import { NestedFieldCard } from './NestedFieldCard';
import { TableView } from '@/components/TableView';
import { useData } from '@/context/DataContext';
import type { SchemaField, FieldError, UIConfig } from '@/types';

/**
 * Hook to generate responsive grid columns based on config breakpoints.
 * Returns a CSS style object with grid-template-columns using CSS clamp/container queries.
 */
function useResponsiveColumns(config: UIConfig | null): { style: React.CSSProperties; className: string } {
  const [columns, setColumns] = React.useState(1);
  
  // Default breakpoints if not provided
  const defaultBreakpoints: Record<number, number> = { 640: 1, 1000: 2, 1600: 3 };
  const breakpoints = config?.responsive_columns || defaultBreakpoints;
  
  React.useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      
      // Sort breakpoints by key (width) in ascending order
      const sortedBreakpoints = Object.entries(breakpoints)
        .map(([k, v]) => [parseInt(k), v] as [number, number])
        .sort((a, b) => a[0] - b[0]);
      
      // Find the appropriate column count based on current width
      let cols = sortedBreakpoints[sortedBreakpoints.length - 1]?.[1] || 1;
      for (const [maxWidth, colCount] of sortedBreakpoints) {
        if (width <= maxWidth) {
          cols = colCount;
          break;
        }
      }
      
      setColumns(cols);
    };
    
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, [breakpoints]);
  
  return {
    style: {
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: '1rem',
    },
    className: 'responsive-grid',
  };
}

interface ObjectEditorProps {
  name: string;
  path: string;
  schema: SchemaField;
  value: Record<string, unknown> | null | undefined;
  errors?: FieldError[];
  disabled?: boolean;
  onChange: (value: unknown) => void;
  depth?: number;
}

export function ObjectEditor({
  name,
  path,
  schema,
  value,
  errors,
  disabled,
  onChange,
  depth = 0,
}: ObjectEditorProps) {
  const { setSelectedPath, toggleExpanded, expandedPaths, config } = useData();
  const [isExpanded, setIsExpanded] = React.useState(depth < 2);
  const { style: gridStyle } = useResponsiveColumns(config);
  
  const fields = schema.fields || {};
  const label = schema.ui_config?.label || schema.title || name;
  const currentValue = value || {};

  const handleFieldChange = (fieldName: string, fieldValue: unknown) => {
    onChange({
      ...currentValue,
      [fieldName]: fieldValue,
    });
  };

  // Get errors for a specific field
  const getFieldErrors = (fieldPath: string): FieldError[] => {
    if (!errors) return [];
    return errors.filter(
      (e) => e.path === fieldPath || e.path.startsWith(fieldPath + '.')
    );
  };

  // Filter visible fields
  const visibleFields = Object.entries(fields).filter(
    ([, field]) => !field.ui_config?.hidden
  );

  // Separate primitive and nested fields
  const primitiveFields: [string, SchemaField][] = [];
  const nestedFields: [string, SchemaField][] = [];
  
  visibleFields.forEach(([fieldName, field]) => {
    if (field.type === 'object' || field.type === 'array') {
      nestedFields.push([fieldName, field]);
    } else {
      primitiveFields.push([fieldName, field]);
    }
  });

  // Group primitive fields by group name
  const groupedPrimitiveFields = React.useMemo(() => {
    const groups: Record<string, [string, SchemaField][]> = {};
    const ungrouped: [string, SchemaField][] = [];

    primitiveFields.forEach(([fieldName, field]) => {
      const group = field.ui_config?.group;
      if (group) {
        if (!groups[group]) {
          groups[group] = [];
        }
        groups[group].push([fieldName, field]);
      } else {
        ungrouped.push([fieldName, field]);
      }
    });

    return { groups, ungrouped };
  }, [primitiveFields]);

  // Navigate to nested field
  const handleNavigateToNested = (fieldPath: string) => {
    // Expand parent paths
    const parts = fieldPath.split('.');
    let currentPath = '';
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}.${part}` : part;
      if (!expandedPaths.has(currentPath)) {
        toggleExpanded(currentPath);
      }
    }
    // Select the nested field
    setSelectedPath(fieldPath);
  };

  const renderPrimitiveField = ([fieldName, fieldSchema]: [string, SchemaField]) => {
    // Build field path - handle empty/root base path
    const fieldPath = path && path !== 'root' ? `${path}.${fieldName}` : fieldName;
    const fieldValue = currentValue[fieldName];
    const fieldErrors = getFieldErrors(fieldPath);

    // Primitive fields
    return (
      <div key={fieldName} className="py-2">
        <FieldRenderer
          name={fieldName}
          path={fieldPath}
          schema={fieldSchema}
          value={fieldValue}
          errors={fieldErrors}
          disabled={disabled}
          onChange={(v) => handleFieldChange(fieldName, v)}
        />
      </div>
    );
  };

  const renderNestedFieldCard = ([fieldName, fieldSchema]: [string, SchemaField]) => {
    const fieldPath = path && path !== 'root' ? `${path}.${fieldName}` : fieldName;
    const fieldValue = currentValue[fieldName];
    const fieldErrors = getFieldErrors(fieldPath);

    return (
      <NestedFieldCard
        key={fieldName}
        name={fieldName}
        schema={fieldSchema}
        value={fieldValue}
        path={fieldPath}
        onNavigate={handleNavigateToNested}
        onChange={(v) => handleFieldChange(fieldName, v)}
        disabled={disabled}
        errors={fieldErrors}
      />
    );
  };

  if (depth === 0) {
    // Root level - render primitive fields in responsive grid and nested fields as cards
    return (
      <div className="space-y-6">
        {/* Primitive fields in responsive grid */}
        {groupedPrimitiveFields.ungrouped.length > 0 && (
          <div style={gridStyle}>
            {groupedPrimitiveFields.ungrouped.map(renderPrimitiveField)}
          </div>
        )}
        
        {/* Grouped primitive fields */}
        {Object.entries(groupedPrimitiveFields.groups).map(([groupName, fields]) => (
          <Card key={groupName}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">{groupName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={gridStyle}>
                {fields.map(renderPrimitiveField)}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Nested fields as cards */}
        {nestedFields.length > 0 && (
          <div className="space-y-3">
            {(groupedPrimitiveFields.ungrouped.length > 0 || Object.keys(groupedPrimitiveFields.groups).length > 0) && (
              <>
                <Separator className="my-4" />
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Nested Objects & Arrays</h3>
              </>
            )}
            <div style={gridStyle}>
              {nestedFields.map(renderNestedFieldCard)}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Nested objects - use collapsible card (this is for inline expansion if needed)
  return (
    <Card className={cn('border-l-4', depth % 2 === 0 ? 'border-l-blue-500' : 'border-l-green-500')}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            {schema.description && !isExpanded && (
              <p className="text-xs text-muted-foreground">{schema.description}</p>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {schema.description && (
              <p className="text-xs text-muted-foreground pb-2">{schema.description}</p>
            )}
            {/* Primitive fields in responsive grid */}
            {groupedPrimitiveFields.ungrouped.length > 0 && (
              <div style={gridStyle}>
                {groupedPrimitiveFields.ungrouped.map(renderPrimitiveField)}
              </div>
            )}
            
            {/* Grouped primitive fields */}
            {Object.entries(groupedPrimitiveFields.groups).map(([groupName, fields]) => (
              <div key={groupName} className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {groupName}
                </h4>
                <div style={gridStyle}>
                  {fields.map(renderPrimitiveField)}
                </div>
              </div>
            ))}
            
            {/* Nested fields as cards */}
            {nestedFields.length > 0 && (
              <div style={gridStyle} className="pt-2">
                {nestedFields.map(renderNestedFieldCard)}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface ArrayEditorProps {
  name: string;
  path: string;
  schema: SchemaField;
  value: unknown[] | null | undefined;
  errors?: FieldError[];
  disabled?: boolean;
  onChange: (value: unknown) => void;
  depth?: number;
}

export function ArrayEditor({
  name,
  path,
  schema,
  value,
  errors,
  disabled,
  onChange,
  depth = 0,
}: ArrayEditorProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  
  const items = value || [];
  const itemSchema = schema.items;
  const label = schema.ui_config?.label || schema.title || name;
  const minItems = schema.min_items;
  const maxItems = schema.max_items;

  const canAdd = maxItems === undefined || items.length < maxItems;
  const canRemove = minItems === undefined || items.length > minItems;

  // Get errors for a specific item
  const getItemErrors = (index: number): FieldError[] => {
    if (!errors) return [];
    const basePath = path && path !== 'root' ? path : '';
    const itemPath = basePath ? `${basePath}[${index}]` : `[${index}]`;
    return errors.filter(
      (e) => e.path === itemPath || e.path.startsWith(itemPath + '.')
    );
  };

  const handleItemChange = (index: number, itemValue: unknown) => {
    const newItems = [...items];
    newItems[index] = itemValue;
    onChange(newItems);
  };

  const handleAddItem = () => {
    if (!canAdd) return;
    
    // Create default value based on item type
    let defaultValue: unknown = null;
    if (itemSchema) {
      switch (itemSchema.type) {
        case 'string':
          defaultValue = '';
          break;
        case 'integer':
        case 'number':
          defaultValue = 0;
          break;
        case 'boolean':
          defaultValue = false;
          break;
        case 'object':
          defaultValue = {};
          break;
        case 'array':
          defaultValue = [];
          break;
      }
    }
    
    onChange([...items, defaultValue]);
  };

  const handleRemoveItem = (index: number) => {
    if (!canRemove) return;
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleDuplicateItem = (index: number) => {
    if (!canAdd) return;
    const itemToDuplicate = JSON.parse(JSON.stringify(items[index]));
    const newItems = [...items];
    newItems.splice(index + 1, 0, itemToDuplicate);
    onChange(newItems);
  };

  const handleMoveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const newItems = [...items];
    const [removed] = newItems.splice(from, 1);
    newItems.splice(to, 0, removed);
    onChange(newItems);
  };

  const renderItem = (item: unknown, index: number) => {
    const basePath = path && path !== 'root' ? path : '';
    const itemPath = basePath ? `${basePath}[${index}]` : `[${index}]`;
    const itemErrors = getItemErrors(index);

    if (!itemSchema) {
      return (
        <div key={index} className="p-3 border rounded-md bg-muted/20">
          <pre className="text-xs">{JSON.stringify(item, null, 2)}</pre>
        </div>
      );
    }

    if (itemSchema.type === 'object' && itemSchema.fields) {
      return (
        <Card key={index} className="relative group">
          <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex flex-col gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleMoveItem(index, index - 1)}
                disabled={disabled || index === 0}
                title="Move up"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <GripVertical className="h-4 w-4 text-muted-foreground mx-auto" />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleMoveItem(index, index + 1)}
                disabled={disabled || index === items.length - 1}
                title="Move down"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <CardHeader className="py-2 pl-10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Item {index + 1}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleDuplicateItem(index)}
                  disabled={disabled || !canAdd}
                  title="Duplicate"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => handleRemoveItem(index)}
                  disabled={disabled || !canRemove}
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pl-10 pt-0">
            <ObjectEditor
              name={`item_${index}`}
              path={itemPath}
              schema={itemSchema}
              value={item as Record<string, unknown>}
              errors={itemErrors}
              disabled={disabled}
              onChange={(v) => handleItemChange(index, v)}
              depth={depth + 1}
            />
          </CardContent>
        </Card>
      );
    }

    // Primitive items
    return (
      <div key={index} className="flex items-start gap-2 group">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-0.5 pt-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => handleMoveItem(index, index - 1)}
            disabled={disabled || index === 0}
            title="Move up"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => handleMoveItem(index, index + 1)}
            disabled={disabled || index === items.length - 1}
            title="Move down"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex-1">
          <FieldRenderer
            name={`item_${index}`}
            path={itemPath}
            schema={itemSchema}
            value={item}
            errors={itemErrors}
            disabled={disabled}
            onChange={(v) => handleItemChange(index, v)}
          />
        </div>
        <div className="flex flex-col gap-1 mt-6">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => handleDuplicateItem(index)}
            disabled={disabled || !canAdd}
            title="Duplicate item"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => handleRemoveItem(index)}
            disabled={disabled || !canRemove}
            title="Delete item"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card className={cn('border-l-4 border-l-purple-500')}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <span className="text-xs text-muted-foreground">
                  ({items.length} item{items.length !== 1 ? 's' : ''})
                </span>
              </div>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {schema.description && (
              <p className="text-xs text-muted-foreground pb-2">{schema.description}</p>
            )}
            
            {items.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-md">
                No items yet. Click "Add Item" to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => renderItem(item, index))}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              disabled={disabled || !canAdd}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
              {maxItems !== undefined && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({items.length}/{maxItems})
                </span>
              )}
            </Button>

            {errors && errors.length > 0 && errors[0].path === path && (
              <p className="text-xs text-destructive">{errors[0].message}</p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/**
 * ArrayListEditor - A summary view of array items shown when the array node is selected in the tree.
 * Shows a compact representation of each item with delete buttons and an add item button.
 */
interface ArrayListEditorProps {
  name: string;
  path: string;
  schema: SchemaField;
  value: unknown[] | null | undefined;
  errors?: FieldError[];
  disabled?: boolean;
  onChange: (value: unknown) => void;
}

// Get a compact representation of an item for display
function getItemRepr(item: unknown): string {
  if (item === null || item === undefined) {
    return 'null';
  }

  if (typeof item === 'object' && !Array.isArray(item)) {
    const obj = item as Record<string, unknown>;
    // Try to find a meaningful name/title/label field first
    const nameField = obj.name || obj.title || obj.label || obj.id;
    if (nameField && typeof nameField === 'string') {
      // Show the primary identifier plus a few other fields
      const otherFields = Object.entries(obj)
        .filter(([k]) => !['name', 'title', 'label', 'id'].includes(k))
        .slice(0, 2)
        .map(([k, v]) => `${k}: ${formatValue(v)}`)
        .join(', ');
      return otherFields ? `${nameField} (${otherFields})` : String(nameField);
    }
    // Otherwise show first few key-value pairs
    const entries = Object.entries(obj).slice(0, 3);
    const repr = entries.map(([k, v]) => `${k}: ${formatValue(v)}`).join(', ');
    if (Object.keys(obj).length > 3) {
      return `{ ${repr}, ... }`;
    }
    return `{ ${repr} }`;
  }

  if (Array.isArray(item)) {
    return `[${item.length} items]`;
  }

  return String(item);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    if (value.length > 20) {
      return `"${value.substring(0, 17)}..."`;
    }
    return `"${value}"`;
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `[${value.length}]`;
    }
    return '{...}';
  }
  return String(value);
}

// Get a title for an array item based on its schema and value
function getArrayItemTitle(item: unknown, index: number, itemSchema?: SchemaField): string {
  if (item === null || item === undefined) {
    return `Item ${index + 1}`;
  }

  // If the schema has a title template or specific display field, use it
  const titleField = itemSchema?.ui_config?.props?.title_field as string | undefined;
  
  if (typeof item === 'object' && !Array.isArray(item)) {
    const obj = item as Record<string, unknown>;
    
    // Try to use the title_field from config first
    if (titleField && obj[titleField] !== undefined) {
      return String(obj[titleField]);
    }
    
    // Try common name fields
    const nameField = obj.name || obj.title || obj.label || obj.id;
    if (nameField && (typeof nameField === 'string' || typeof nameField === 'number')) {
      return String(nameField);
    }
    
    // Fallback to index
    return `Item ${index + 1}`;
  }

  return `Item ${index + 1}`;
}

export function ArrayListEditor({
  name: _name,
  path,
  schema,
  value,
  errors,
  disabled,
  onChange,
}: ArrayListEditorProps) {
  const { setSelectedPath, toggleExpanded, expandedPaths } = useData();
  const [viewMode, setViewMode] = React.useState<'list' | 'table'>('list');
  
  const items = value || [];
  const itemSchema = schema.items;
  const minItems = schema.min_items;
  const maxItems = schema.max_items;

  const canAdd = maxItems === undefined || items.length < maxItems;
  const canRemove = minItems === undefined || items.length > minItems;

  // Check if items are primitive types that can be edited inline
  const itemsArePrimitive = itemSchema && 
    ['string', 'integer', 'number', 'boolean'].includes(itemSchema.type);
  
  // Check if items are objects (should be shown as cards or table)
  const itemsAreObjects = itemSchema?.type === 'object';
  
  // Check if table view is available (items have nested structure)
  const canShowTableView = itemSchema && 
    (itemSchema.type === 'object' || 
     (itemSchema.type !== 'array' && !itemsArePrimitive));

  const handleRemoveItem = (index: number) => {
    if (!canRemove) return;
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleDuplicateItem = (index: number) => {
    if (!canAdd) return;
    // Deep clone the item to avoid reference issues
    const itemToDuplicate = JSON.parse(JSON.stringify(items[index]));
    const newItems = [...items];
    // Insert the duplicate after the original
    newItems.splice(index + 1, 0, itemToDuplicate);
    onChange(newItems);
  };

  const handleAddItem = () => {
    if (!canAdd) return;
    
    // Create default value based on item type
    let defaultValue: unknown = null;
    if (itemSchema) {
      switch (itemSchema.type) {
        case 'string':
          defaultValue = '';
          break;
        case 'integer':
        case 'number':
          defaultValue = 0;
          break;
        case 'boolean':
          defaultValue = false;
          break;
        case 'object':
          defaultValue = {};
          break;
        case 'array':
          defaultValue = [];
          break;
      }
    }
    
    const newItems = [...items, defaultValue];
    onChange(newItems);
    
    // For non-primitive items, auto-expand and select the new item
    if (!itemsArePrimitive) {
      const basePath = path && path !== 'root' ? path : '';
      if (!expandedPaths.has(basePath)) {
        toggleExpanded(basePath);
      }
      // Select the newly added item
      const newItemPath = basePath ? `${basePath}[${newItems.length - 1}]` : `[${newItems.length - 1}]`;
      setTimeout(() => setSelectedPath(newItemPath), 50);
    }
  };

  const handleItemChange = (index: number, newValue: unknown) => {
    const newItems = [...items];
    newItems[index] = newValue;
    onChange(newItems);
  };

  const handleMoveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const newItems = [...items];
    const [removed] = newItems.splice(from, 1);
    newItems.splice(to, 0, removed);
    onChange(newItems);
  };

  const handleNavigateToItem = (index: number) => {
    const basePath = path && path !== 'root' ? path : '';
    const itemPath = basePath ? `${basePath}[${index}]` : `[${index}]`;
    
    // Expand parent paths
    if (!expandedPaths.has(basePath)) {
      toggleExpanded(basePath);
    }
    
    setSelectedPath(itemPath);
  };

  // Get errors for a specific item
  const getItemErrors = (index: number): FieldError[] => {
    if (!errors) return [];
    const basePath = path && path !== 'root' ? path : '';
    const itemPath = basePath ? `${basePath}[${index}]` : `[${index}]`;
    return errors.filter(
      (e) => e.path === itemPath || e.path.startsWith(itemPath + '.')
    );
  };

  return (
    <div className="space-y-4">
      {schema.description && (
        <p className="text-sm text-muted-foreground">{schema.description}</p>
      )}
      
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {items.length} item{items.length !== 1 ? 's' : ''}
          {minItems !== undefined && ` (min: ${minItems})`}
          {maxItems !== undefined && ` (max: ${maxItems})`}
        </span>
        
        {/* View mode toggle */}
        {canShowTableView && items.length > 0 && (
          <div className="flex items-center gap-1 border rounded-md p-0.5">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              <Table className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Table View */}
      {viewMode === 'table' && canShowTableView && items.length > 0 ? (
        <TableView
          name={path || 'root'}
          path={path || 'root'}
          schema={schema}
          value={items}
          errors={errors}
          disabled={disabled}
          onChange={onChange}
        />
      ) : (
        /* List View */
        <>
          {items.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-md">
              No items yet. Click "Add Item" to get started.
            </div>
          ) : itemsAreObjects ? (
        // Render object items as cards (like NestedFieldCard)
        <div className="grid gap-3">
          {items.map((item, index) => {
            const itemErrors = getItemErrors(index);
            const hasError = itemErrors.length > 0;
            
            return (
            <div key={index} className="space-y-1">
              <div className="flex gap-2">
              <Card
                className={cn(
                  'flex-1 cursor-pointer transition-all',
                  'hover:border-primary hover:shadow-md',
                  'group',
                  hasError && 'border-destructive'
                )}
                onClick={() => handleNavigateToItem(index)}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex-shrink-0">
                    <Folder className={cn('h-5 w-5', hasError ? 'text-destructive' : 'text-blue-500')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={cn('font-medium truncate text-sm', hasError && 'text-destructive')}>
                      {getArrayItemTitle(item, index, itemSchema)}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {getItemRepr(item)}
                    </p>
                  </div>
                  {hasError && (
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <Badge variant="secondary" className="shrink-0">
                    Item {index + 1}
                  </Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </CardContent>
              </Card>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-auto px-2"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveItem(index, index - 1);
                    }}
                    disabled={disabled || index === 0}
                  >
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Move Up
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveItem(index, index + 1);
                    }}
                    disabled={disabled || index === items.length - 1}
                  >
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Move Down
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateItem(index);
                    }}
                    disabled={disabled || !canAdd}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveItem(index);
                    }}
                    disabled={disabled || !canRemove}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
              {hasError && (
                <p className="text-xs text-destructive px-1">{itemErrors[0].message}</p>
              )}
            </div>
          );
          })}
        </div>
      ) : itemsArePrimitive && itemSchema ? (
        // Render primitive items with inline editing
        <div className="space-y-2">
          {items.map((item, index) => {
            const basePath = path && path !== 'root' ? path : '';
            const itemPath = basePath ? `${basePath}[${index}]` : `[${index}]`;
            const itemErrors = getItemErrors(index);
            
            return (
              <div key={index} className="flex items-start gap-2 group">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-0.5 pt-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => handleMoveItem(index, index - 1)}
                    disabled={disabled || index === 0}
                    title="Move up"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => handleMoveItem(index, index + 1)}
                    disabled={disabled || index === items.length - 1}
                    title="Move down"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex-1">
                  <FieldRenderer
                    name={`item_${index}`}
                    path={itemPath}
                    schema={{
                      ...itemSchema,
                      // Override title to show item index
                      title: itemSchema.title ? `${itemSchema.title} ${index + 1}` : `Item ${index + 1}`,
                    }}
                    value={item}
                    errors={itemErrors}
                    disabled={disabled}
                    onChange={(v) => handleItemChange(index, v)}
                  />
                </div>
                <div className="flex flex-col gap-1 mt-6">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDuplicateItem(index)}
                    disabled={disabled || !canAdd}
                    title="Duplicate item"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveItem(index)}
                    disabled={disabled || !canRemove}
                    title="Delete item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Render other non-primitive items (like nested arrays) as a simple list with navigation
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="group flex items-center gap-2 p-3 border rounded-md hover:bg-accent/50 transition-colors"
            >
              <span className="text-xs text-muted-foreground w-6 shrink-0">
                {index + 1}.
              </span>
              <button
                className="flex-1 text-left text-sm truncate hover:text-primary cursor-pointer"
                onClick={() => handleNavigateToItem(index)}
                title="Click to edit"
              >
                {getItemRepr(item)}
              </button>
              <ChevronRight 
                className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" 
                onClick={() => handleNavigateToItem(index)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveItem(index, index - 1);
                    }}
                    disabled={disabled || index === 0}
                  >
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Move Up
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveItem(index, index + 1);
                    }}
                    disabled={disabled || index === items.length - 1}
                  >
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Move Down
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateItem(index);
                    }}
                    disabled={disabled || !canAdd}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveItem(index);
                    }}
                    disabled={disabled || !canRemove}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

          <Button
            variant="outline"
            onClick={handleAddItem}
            disabled={disabled || !canAdd}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
            {maxItems !== undefined && (
              <span className="text-xs text-muted-foreground ml-2">
                ({items.length}/{maxItems})
              </span>
            )}
          </Button>
        </>
      )}

      {errors && errors.length > 0 && errors[0].path === path && (
        <p className="text-sm text-destructive">{errors[0].message}</p>
      )}
    </div>
  );
}

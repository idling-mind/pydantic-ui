import React from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { FieldRenderer } from '@/components/Renderers';
import { useData } from '@/context/DataContext';
import type { SchemaField, FieldError } from '@/types';

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
  const [isExpanded, setIsExpanded] = React.useState(depth < 2);
  
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

  // Group fields by group name
  const groupedFields = React.useMemo(() => {
    const groups: Record<string, [string, SchemaField][]> = {};
    const ungrouped: [string, SchemaField][] = [];

    visibleFields.forEach(([fieldName, field]) => {
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
  }, [visibleFields]);

  const renderField = ([fieldName, fieldSchema]: [string, SchemaField]) => {
    // Build field path - handle empty/root base path
    const fieldPath = path && path !== 'root' ? `${path}.${fieldName}` : fieldName;
    const fieldValue = currentValue[fieldName];
    const fieldErrors = getFieldErrors(fieldPath);

    // Handle nested objects
    if (fieldSchema.type === 'object' && fieldSchema.fields) {
      return (
        <ObjectEditor
          key={fieldName}
          name={fieldName}
          path={fieldPath}
          schema={fieldSchema}
          value={fieldValue as Record<string, unknown>}
          errors={fieldErrors}
          disabled={disabled}
          onChange={(v) => handleFieldChange(fieldName, v)}
          depth={depth + 1}
        />
      );
    }

    // Handle arrays
    if (fieldSchema.type === 'array') {
      return (
        <ArrayEditor
          key={fieldName}
          name={fieldName}
          path={fieldPath}
          schema={fieldSchema}
          value={fieldValue as unknown[]}
          errors={fieldErrors}
          disabled={disabled}
          onChange={(v) => handleFieldChange(fieldName, v)}
          depth={depth + 1}
        />
      );
    }

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

  if (depth === 0) {
    // Root level - no card wrapper
    return (
      <div className="space-y-4">
        {groupedFields.ungrouped.map(renderField)}
        {Object.entries(groupedFields.groups).map(([groupName, fields]) => (
          <Card key={groupName}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">{groupName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.map(renderField)}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Nested objects - use collapsible card
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
            {groupedFields.ungrouped.map(renderField)}
            {Object.entries(groupedFields.groups).map(([groupName, fields]) => (
              <div key={groupName} className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {groupName}
                </h4>
                {fields.map(renderField)}
              </div>
            ))}
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
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => handleRemoveItem(index)}
                disabled={disabled || !canRemove}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
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
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => handleMoveItem(index, index + 1)}
            disabled={disabled || index === items.length - 1}
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
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive mt-6"
          onClick={() => handleRemoveItem(index)}
          disabled={disabled || !canRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
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
  
  const items = value || [];
  const itemSchema = schema.items;
  const minItems = schema.min_items;
  const maxItems = schema.max_items;

  const canAdd = maxItems === undefined || items.length < maxItems;
  const canRemove = minItems === undefined || items.length > minItems;

  const handleRemoveItem = (index: number) => {
    if (!canRemove) return;
    const newItems = items.filter((_, i) => i !== index);
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
    
    // Auto-expand the array and select the new item
    const basePath = path && path !== 'root' ? path : '';
    if (!expandedPaths.has(basePath)) {
      toggleExpanded(basePath);
    }
    // Select the newly added item
    const newItemPath = basePath ? `${basePath}[${newItems.length - 1}]` : `[${newItems.length - 1}]`;
    setTimeout(() => setSelectedPath(newItemPath), 50);
  };

  const handleNavigateToItem = (index: number) => {
    const basePath = path && path !== 'root' ? path : '';
    const itemPath = basePath ? `${basePath}[${index}]` : `[${index}]`;
    setSelectedPath(itemPath);
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
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-md">
          No items yet. Click "Add Item" to get started.
        </div>
      ) : (
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
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  handleRemoveItem(index);
                }}
                disabled={disabled || !canRemove}
                title="Delete item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
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

      {errors && errors.length > 0 && errors[0].path === path && (
        <p className="text-sm text-destructive">{errors[0].message}</p>
      )}
    </div>
  );
}

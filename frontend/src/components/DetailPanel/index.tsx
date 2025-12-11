import React from 'react';
import { Save, RotateCcw, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { ObjectEditor, ArrayEditor, ArrayListEditor } from './ObjectEditor';
import { FieldRenderer } from '@/components/Renderers';
import { ActionButtons } from '@/components/ActionButtons';
import { OrphanedErrors } from './OrphanedErrors';
import type { SchemaField } from '@/types';

interface DetailPanelProps {
  className?: string;
}

export function DetailPanel({ className }: DetailPanelProps) {
  const {
    schema,
    config,
    data,
    errors,
    loading,
    dirty,
    updateValue,
    saveData,
    resetData,
    selectedPath,
  } = useData();

  const [saving, setSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const success = await saveData();
      if (success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    resetData();
  };

  // Get the schema and value for the selected path
  const getSelectedSchema = () => {
    if (!schema || selectedPath === null) {
      return { selectedSchema: schema, selectedValue: data, basePath: '', isArrayItem: false, arrayPath: '', arrayIndex: -1 };
    }

    // Empty path means root selection
    if (selectedPath === '') {
      return { selectedSchema: schema, selectedValue: data, basePath: '', isArrayItem: false, arrayPath: '', arrayIndex: -1 };
    }

    // Parse the path, handling both dot notation and array index notation
    // e.g., "users[0].name" or "settings.items[2]"
    const pathRegex = /([^.\[\]]+)|\[(\d+)\]/g;
    const parts: { key: string; isIndex: boolean }[] = [];
    let match;
    while ((match = pathRegex.exec(selectedPath)) !== null) {
      if (match[1] !== undefined) {
        parts.push({ key: match[1], isIndex: false });
      } else if (match[2] !== undefined) {
        parts.push({ key: match[2], isIndex: true });
      }
    }

    let currentSchema = schema;
    let currentValue: unknown = data;
    let basePath = '';
    let isArrayItem = false;
    let arrayPath = '';
    let arrayIndex = -1;

    // Helper to get the depth of array nesting for a schema
    const getSchemaArrayDepth = (s: SchemaField): number => {
      if (s.type !== 'array') return 0;
      if (!s.items) return 1;
      return 1 + getSchemaArrayDepth(s.items);
    };

    // Helper to get the innermost item type for an array schema
    const getSchemaLeafItemType = (s: SchemaField): string | null => {
      if (s.type !== 'array') return null;
      if (!s.items) return null;
      if (s.items.type === 'array') {
        return getSchemaLeafItemType(s.items);
      }
      return s.items.type;
    };

    // Helper to get array depth from value
    const getArrayDepth = (v: unknown): number => {
      if (!Array.isArray(v)) return 0;
      if (v.length === 0) return 1;
      return 1 + getArrayDepth(v[0]);
    };

    // Helper to get leaf item type from array values
    const getValueLeafItemType = (v: unknown[]): string | null => {
      if (v.length === 0) return null;
      const firstItem = v.find(item => item !== null && item !== undefined);
      if (firstItem === undefined) return null;
      if (Array.isArray(firstItem)) {
        return getValueLeafItemType(firstItem);
      }
      const jsType = typeof firstItem;
      if (jsType === 'string') return 'string';
      if (jsType === 'number') return Number.isInteger(firstItem) ? 'integer' : 'number';
      if (jsType === 'boolean') return 'boolean';
      if (jsType === 'object') return 'object';
      return null;
    };

    // Helper to detect current variant for union schemas
    // This handles discriminated unions, object structure matching, and primitive type matching
    const detectVariant = (unionSchema: SchemaField, value: unknown): SchemaField | null => {
      if (!unionSchema.variants || value === null || value === undefined) {
        return null;
      }
      
      // Check discriminator first (for discriminated unions)
      const discriminator = unionSchema.discriminator;
      if (discriminator?.field && discriminator.mapping && typeof value === 'object' && !Array.isArray(value)) {
        const discValue = (value as Record<string, unknown>)[discriminator.field];
        if (discValue !== undefined) {
          const variantIndex = discriminator.mapping[String(discValue)];
          if (variantIndex !== undefined && unionSchema.variants[variantIndex]) {
            return unionSchema.variants[variantIndex];
          }
        }
      }
      
      // Try to detect by structure matching for objects
      if (typeof value === 'object' && !Array.isArray(value)) {
        const valueKeys = Object.keys(value as Record<string, unknown>);
        for (const variant of unionSchema.variants) {
          if (variant.type === 'object' && variant.fields) {
            const variantKeys = Object.keys(variant.fields);
            const requiredKeys = variantKeys.filter(k => variant.fields![k].required !== false);
            if (requiredKeys.every(k => valueKeys.includes(k))) {
              return variant;
            }
          }
        }
      }
      
      // For arrays, match by depth AND item type to distinguish list[int] from list[str]
      if (Array.isArray(value)) {
        const valueDepth = getArrayDepth(value);
        const valueLeafType = getValueLeafItemType(value);
        
        const arrayVariants = unionSchema.variants
          .map((v, idx) => ({ 
            variant: v, 
            index: idx, 
            depth: getSchemaArrayDepth(v),
            leafType: getSchemaLeafItemType(v)
          }))
          .filter(v => v.variant.type === 'array');
        
        // If we have items in the array, try to match both depth and item type
        if (valueLeafType !== null) {
          const exactMatch = arrayVariants.find(v => 
            v.depth === valueDepth && v.leafType === valueLeafType
          );
          if (exactMatch) {
            return exactMatch.variant;
          }
          
          // Try matching with compatible types (integer matches number)
          const typeMatch = arrayVariants.find(v => {
            if (v.depth !== valueDepth) return false;
            if (v.leafType === valueLeafType) return true;
            if (valueLeafType === 'integer' && v.leafType === 'number') return true;
            return false;
          });
          if (typeMatch) {
            return typeMatch.variant;
          }
        }
        
        // For empty arrays or when no type match, try depth match first
        const depthMatch = arrayVariants.find(v => v.depth === valueDepth);
        if (depthMatch) {
          return depthMatch.variant;
        }
        
        // Fall back to first array variant
        if (arrayVariants.length > 0) {
          arrayVariants.sort((a, b) => a.depth - b.depth);
          return arrayVariants[0].variant;
        }
      }
      
      // For primitive values, match by type
      const valueType = typeof value;
      for (const variant of unionSchema.variants) {
        if (
          (valueType === 'string' && variant.type === 'string') ||
          (valueType === 'number' && (variant.type === 'integer' || variant.type === 'number')) ||
          (valueType === 'boolean' && variant.type === 'boolean')
        ) {
          return variant;
        }
      }
      
      return null;
    };

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!currentSchema) break;

      if (part.isIndex) {
        // Array index access
        const index = parseInt(part.key, 10);
        if (currentSchema.type === 'array' && currentSchema.items) {
          arrayPath = basePath;
          arrayIndex = index;
          isArrayItem = true;
          currentSchema = currentSchema.items;
          currentValue = (currentValue as unknown[])?.[index];
          basePath = basePath ? `${basePath}[${index}]` : `[${index}]`;
        } else if (currentSchema.type === 'union') {
          // Union that is actually an array (detected variant is array type)
          const detectedVariant = detectVariant(currentSchema, currentValue);
          if (detectedVariant?.type === 'array' && detectedVariant.items) {
            arrayPath = basePath;
            arrayIndex = index;
            isArrayItem = true;
            currentSchema = detectedVariant.items;
            currentValue = (currentValue as unknown[])?.[index];
            basePath = basePath ? `${basePath}[${index}]` : `[${index}]`;
          } else {
            break;
          }
        } else {
          break;
        }
      } else if (currentSchema.type === 'object' && currentSchema.fields) {
        const fieldSchema = currentSchema.fields[part.key];
        if (fieldSchema) {
          currentSchema = fieldSchema;
          currentValue = (currentValue as Record<string, unknown>)?.[part.key];
          basePath = basePath ? `${basePath}.${part.key}` : part.key;
          // Reset array item tracking when we enter a new object
          if (!parts[i + 1]?.isIndex) {
            isArrayItem = false;
            arrayPath = '';
            arrayIndex = -1;
          }
        } else {
          break;
        }
      } else if (currentSchema.type === 'union') {
        // For unions, detect the variant and look up the field in the variant's schema
        const detectedVariant = detectVariant(currentSchema, currentValue);
        if (detectedVariant?.type === 'object' && detectedVariant.fields) {
          const fieldSchema = detectedVariant.fields[part.key];
          if (fieldSchema) {
            currentSchema = fieldSchema;
            currentValue = (currentValue as Record<string, unknown>)?.[part.key];
            basePath = basePath ? `${basePath}.${part.key}` : part.key;
            // Reset array item tracking when we enter a new object
            if (!parts[i + 1]?.isIndex) {
              isArrayItem = false;
              arrayPath = '';
              arrayIndex = -1;
            }
          } else {
            break;
          }
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return { selectedSchema: currentSchema, selectedValue: currentValue, basePath, isArrayItem, arrayPath, arrayIndex };
  };

  const { selectedSchema, selectedValue, basePath } = getSelectedSchema();

  // Check if editing should be disabled (loading or global read_only)
  const isDisabled = loading || config?.read_only === true;

  // Check if current path is an array item
  const isArrayItemPath = (path: string): boolean => /\[\d+\]$/.test(path);
  
  // Get the display label for the header - same logic as TreeNode
  const getDisplayLabel = (): string => {
    if (!selectedSchema) return config?.title || 'Data Editor';
    if (!basePath) return selectedSchema.ui_config?.label || selectedSchema.title || config?.title || 'Data Editor';
    
    // For array items, try to get label from data (name/label/title fields)
    if (isArrayItemPath(basePath) && selectedValue && typeof selectedValue === 'object' && !Array.isArray(selectedValue)) {
      const obj = selectedValue as Record<string, unknown>;
      const nameField = obj.name || obj.label || obj.title;
      if (nameField && typeof nameField === 'string') {
        return nameField;
      }
      // Fall back to schema label or python type
      if (selectedSchema.ui_config?.label) return selectedSchema.ui_config.label;
      if (selectedSchema.python_type) return selectedSchema.python_type;
    }
    
    return selectedSchema.ui_config?.label || selectedSchema.title || basePath;
  };

  // Get errors for the current selection
  const getRelevantErrors = () => {
    if (!errors || !basePath) return errors;
    return errors.filter(
      (e) => e.path === basePath || e.path.startsWith(basePath + '.') || e.path.startsWith(basePath + '[')
    );
  };

  const relevantErrors = getRelevantErrors();

  const handleChange = (newValue: unknown) => {
    if (!basePath) {
      // Root level change - replace entire data
      if (typeof newValue === 'object' && newValue !== null) {
        Object.entries(newValue as Record<string, unknown>).forEach(([key, val]) => {
          updateValue(key, val);
        });
      }
    } else {
      updateValue(basePath, newValue);
    }
  };

  if (!schema) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading schema...</span>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (!selectedSchema) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Select a field from the tree to edit
        </div>
      );
    }

    // Handle different schema types
    if (selectedSchema.type === 'object' && selectedSchema.fields) {
      return (
        <ObjectEditor
          name={basePath || 'root'}
          path={basePath || 'root'}
          schema={selectedSchema}
          value={selectedValue as Record<string, unknown>}
          errors={relevantErrors}
          disabled={isDisabled}
          onChange={handleChange}
        />
      );
    }

    if (selectedSchema.type === 'array') {
      // Show the array list view (summary with delete buttons)
      return (
        <ArrayListEditor
          name={basePath || 'root'}
          path={basePath || 'root'}
          schema={selectedSchema}
          value={selectedValue as unknown[]}
          errors={relevantErrors}
          disabled={isDisabled}
          onChange={handleChange}
        />
      );
    }

    // Primitive type (could be an array item or a regular field)
    return (
      <FieldRenderer
        name={basePath || 'value'}
        path={basePath || 'value'}
        schema={selectedSchema}
        value={selectedValue}
        errors={relevantErrors}
        disabled={isDisabled}
        onChange={handleChange}
      />
    );
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">
            {getDisplayLabel()}
          </h2>
          <div className="flex items-center gap-2">
            {errors && errors.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.length} error{errors.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {saveSuccess && (
              <Badge variant="default" className="gap-1 bg-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Saved
              </Badge>
            )}
          </div>
        </div>
        {selectedSchema?.description && !basePath && (
          <p className="text-sm text-muted-foreground">{selectedSchema.description}</p>
        )}
        {basePath && (
          <p className="text-xs text-muted-foreground font-mono">{basePath}</p>
        )}
        {/* Show orphaned errors (errors for paths not found in schema) */}
        {selectedSchema && relevantErrors && relevantErrors.length > 0 && (
          <OrphanedErrors
            errors={relevantErrors}
            basePath={basePath || ''}
            schema={selectedSchema}
            className="mt-3"
          />
        )}
      </div>

      <Separator />

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {renderContent()}
        </div>
      </ScrollArea>

      <Separator />

      {/* Footer Actions */}
      <div className="p-4 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          {/* Custom Action Buttons */}
          {config?.actions && config.actions.length > 0 && (
            <ActionButtons actions={config.actions} />
          )}
          {dirty && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Unsaved changes
            </span>
          )}
        </div>
        {config?.show_save_reset && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={loading || saving || !dirty}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={loading || saving || !dirty}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export { ObjectEditor, ArrayEditor, ArrayListEditor };
export { NestedFieldCard } from './NestedFieldCard';

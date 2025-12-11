import React from 'react';
import { AlertCircle, Layers } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn, createDefaultFromSchema } from '@/lib/utils';
import type { RendererProps } from './types';
import type { SchemaField, UnionVariant } from '@/types';
import { ObjectEditor, ArrayListEditor } from '@/components/DetailPanel/ObjectEditor';
import { FieldRenderer } from '@/components/Renderers';

/**
 * Get the depth of array nesting for a value.
 * e.g., [] -> 1, [[]] -> 2, [[[]]] -> 3
 */
function getArrayDepth(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  if (value.length === 0) return 1; // Empty array, at least depth 1
  // Check the first element to determine nested depth
  return 1 + getArrayDepth(value[0]);
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
 * Detect which variant the current value matches.
 * Uses discriminator if available, otherwise tries to match by structure.
 */
function detectCurrentVariant(
  value: unknown,
  schema: SchemaField
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const variants = schema.variants;
  if (!variants || variants.length === 0) {
    return null;
  }

  // If there's a discriminator, use it to determine the variant
  const discriminator = schema.discriminator;
  if (discriminator?.field && discriminator.mapping) {
    if (typeof value === 'object' && !Array.isArray(value)) {
      const discValue = (value as Record<string, unknown>)[discriminator.field];
      if (discValue !== undefined) {
        const variantIndex = discriminator.mapping[String(discValue)];
        if (variantIndex !== undefined) {
          return variantIndex;
        }
      }
    }
  }

  // Try to detect by type matching
  if (typeof value === 'object' && !Array.isArray(value)) {
    // For objects, try to find a variant that matches the structure
    const valueKeys = Object.keys(value as Record<string, unknown>);
    
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      if (variant.type === 'object' && variant.fields) {
        const variantKeys = Object.keys(variant.fields);
        // Check if all required variant fields exist in the value
        const requiredKeys = variantKeys.filter(k => variant.fields![k].required !== false);
        const matchesRequired = requiredKeys.every(k => valueKeys.includes(k));
        if (matchesRequired) {
          return i;
        }
      }
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
        return exactMatch.index;
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
        return typeMatch.index;
      }
    }
    
    // For empty arrays or when no type match, try depth match first
    const depthMatch = arrayVariants.find(v => v.depth === valueDepth);
    if (depthMatch) {
      return depthMatch.index;
    }
    
    // If no exact match (e.g., empty array), prefer the shallowest array variant
    // since empty arrays are ambiguous
    if (arrayVariants.length > 0) {
      arrayVariants.sort((a, b) => a.depth - b.depth);
      return arrayVariants[0].index;
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
      return i;
    }
  }

  return null;
}

/**
 * Get the display label for a variant.
 * For arrays/primitives: uses python_type (e.g., 'list[str]', 'list[int]') for clarity
 * For objects: uses variant_name (class name) > title > generic fallback
 */
function getVariantLabel(variant: UnionVariant): string {
  // For arrays and primitives, python_type provides more useful info (e.g., 'list[str]' vs 'list')
  if (variant.type === 'array' || ['string', 'integer', 'number', 'boolean'].includes(variant.type)) {
    if (variant.python_type) {
      return variant.python_type;
    }
  }
  // For objects (Pydantic models), prefer the class name
  return variant.variant_name || variant.title || `Type ${variant.variant_index + 1}`;
}

/**
 * UnionInput component for rendering union/discriminated union fields.
 * 
 * Features:
 * - Tabbed interface for small number of variants (≤4) with smooth animations
 * - Dropdown selector for larger number of variants (>4) or discriminated unions
 * - Automatic variant detection based on current value
 * - Confirmation dialog when switching variants (data loss warning)
 */
export function UnionInput({
  name,
  path,
  schema,
  value,
  errors,
  disabled,
  onChange,
}: RendererProps) {
  const [selectedVariantIndex, setSelectedVariantIndex] = React.useState<number | null>(() => 
    detectCurrentVariant(value, schema)
  );
  const [pendingVariantIndex, setPendingVariantIndex] = React.useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);

  const variants = schema.variants || [];
  const hasDiscriminator = !!schema.discriminator?.field;
  const discriminatorField = schema.discriminator?.field;
  
  // Use tabbed interface for ≤6 variants, select dropdown for more
  const useTabs = variants.length <= 6;
  
  const label = schema.ui_config?.label || schema.title || name;
  const helpText = schema.ui_config?.help_text || schema.description;

  // Get errors for this field
  const fieldErrors = React.useMemo(() => {
    if (!errors) return [];
    return errors.filter(e => e.path === path || e.path.startsWith(path + '.'));
  }, [errors, path]);

  const hasError = fieldErrors.length > 0;

  // Track previous path and value to detect navigation and resets
  const prevPathRef = React.useRef(path);
  const prevValueRef = React.useRef(value);
  
  React.useEffect(() => {
    const prevPath = prevPathRef.current;
    const prevValue = prevValueRef.current;
    prevPathRef.current = path;
    prevValueRef.current = value;
    
    // If the path changed, we navigated to a different field - re-detect variant
    if (prevPath !== path) {
      const detected = detectCurrentVariant(value, schema);
      setSelectedVariantIndex(detected);
      return;
    }
    
    // If value was reset to null/undefined from a non-null value, clear selection
    if ((value === null || value === undefined) && prevValue !== null && prevValue !== undefined) {
      setSelectedVariantIndex(null);
      return;
    }
    
    // If we have a value but no selected variant, try to detect it
    // This handles cases where value changes externally (e.g., from parent component)
    if (selectedVariantIndex === null && value !== null && value !== undefined) {
      const detected = detectCurrentVariant(value, schema);
      if (detected !== null) {
        setSelectedVariantIndex(detected);
      }
    }
  }, [path, value, schema, selectedVariantIndex]);

  /**
   * Handle variant change - may require confirmation if data will be lost.
   */
  const handleVariantChange = (newVariantIndex: number) => {
    // If there's existing data and it's different from the new variant, confirm
    if (value !== null && value !== undefined && selectedVariantIndex !== null && selectedVariantIndex !== newVariantIndex) {
      setPendingVariantIndex(newVariantIndex);
      setShowConfirmDialog(true);
    } else {
      applyVariantChange(newVariantIndex);
    }
  };

  /**
   * Apply the variant change, creating default data for the new variant.
   */
  const applyVariantChange = (newVariantIndex: number) => {
    const newVariant = variants[newVariantIndex];
    if (!newVariant) return;

    // Create default value for the new variant
    let newValue = createDefaultFromSchema(newVariant);
    
    // If discriminated, set the discriminator field
    if (hasDiscriminator && discriminatorField && newVariant.discriminator_values?.length) {
      if (typeof newValue === 'object' && newValue !== null) {
        (newValue as Record<string, unknown>)[discriminatorField] = newVariant.discriminator_values[0];
      }
    }
    
    setSelectedVariantIndex(newVariantIndex);
    onChange(newValue);
    setShowConfirmDialog(false);
    setPendingVariantIndex(null);
  };

  /**
   * Handle change within the current variant.
   */
  const handleVariantDataChange = (newData: unknown) => {
    onChange(newData);
  };

  /**
   * Render the content editor for a variant.
   */
  const renderVariantContent = (variantIndex: number) => {
    const variant = variants[variantIndex];
    if (!variant) return null;

    if (variant.type === 'object' && variant.fields) {
      // Filter out the discriminator field from rendering (it's auto-managed)
      const fieldsToRender = { ...variant.fields };
      if (discriminatorField && fieldsToRender[discriminatorField]) {
        // Keep it but mark as read-only
        fieldsToRender[discriminatorField] = {
          ...fieldsToRender[discriminatorField],
          ui_config: {
            ...fieldsToRender[discriminatorField].ui_config,
            read_only: true,
          },
        };
      }

      // Use depth=0 to render fields directly without collapsible wrapper
      // The tabs already provide the visual container
      return (
        <ObjectEditor
          name={variant.variant_name || `variant_${variantIndex}`}
          path={path}
          schema={{ ...variant, fields: fieldsToRender }}
          value={value as Record<string, unknown>}
          errors={fieldErrors}
          disabled={disabled}
          onChange={handleVariantDataChange}
          depth={0}
        />
      );
    }

    // Handle array variants
    if (variant.type === 'array' && variant.items) {
      return (
        <ArrayListEditor
          name={variant.variant_name || `variant_${variantIndex}`}
          path={path}
          schema={variant}
          value={Array.isArray(value) ? value : []}
          errors={fieldErrors}
          disabled={disabled}
          onChange={handleVariantDataChange}
        />
      );
    }

    // For primitive variants
    return (
      <FieldRenderer
        name={variant.variant_name || `variant_${variantIndex}`}
        path={path}
        schema={variant}
        value={value}
        errors={fieldErrors}
        disabled={disabled}
        onChange={handleVariantDataChange}
      />
    );
  };

  // If no variants, show error state
  if (variants.length === 0) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="p-4 border border-dashed rounded-md text-muted-foreground text-sm">
          No variants defined for this union type.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Label */}
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <Label className={cn(hasError && 'text-destructive')}>{label}</Label>
        {schema.required && <span className="text-destructive">*</span>}
        <Badge variant="outline" className="ml-auto text-xs">
          Union
        </Badge>
      </div>

      {/* Help text */}
      {helpText && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}

      {/* Error display */}
      {hasError && fieldErrors[0]?.path === path && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {fieldErrors[0].message}
        </div>
      )}

      {/* Variant selector - choose display mode based on variant count */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          {useTabs ? (
            // Tabbed interface for manageable number of variants
            <Tabs
              value={selectedVariantIndex !== null ? String(selectedVariantIndex) : ''}
              onValueChange={(val: string) => {
                if (val) {
                  handleVariantChange(parseInt(val, 10));
                }
              }}
              className="w-full"
            >
              <TabsList className="w-full flex-wrap h-auto gap-1">
                {variants.map((variant, idx) => (
                  <TabsTrigger
                    key={idx}
                    value={String(idx)}
                    disabled={disabled}
                    className={cn(
                      "flex-1 min-w-fit",
                      hasError && selectedVariantIndex === idx && 'border-destructive'
                    )}
                  >
                    {variant.discriminator_values?.length
                      ? variant.discriminator_values.join(' / ')
                      : getVariantLabel(variant)}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {/* Tab content panels - only render when a variant is selected */}
              {selectedVariantIndex !== null && variants.map((_, idx) => (
                <TabsContent key={idx} value={String(idx)} className="mt-4">
                  {selectedVariantIndex === idx && renderVariantContent(idx)}
                </TabsContent>
              ))}
              
              {/* Show placeholder when no variant selected */}
              {selectedVariantIndex === null && (
                <div className="py-4 text-center text-sm text-muted-foreground border border-dashed rounded-md mt-4">
                  Select a type to configure this field.
                </div>
              )}
            </Tabs>
          ) : (
            // Select dropdown for many variants
            <>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={selectedVariantIndex !== null ? String(selectedVariantIndex) : ''}
                  onValueChange={(val: string) => handleVariantChange(parseInt(val, 10))}
                  disabled={disabled}
                >
                  <SelectTrigger className={cn(hasError && 'border-destructive')}>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {variants.map((variant, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        {variant.discriminator_values?.length
                          ? variant.discriminator_values.join(' / ')
                          : getVariantLabel(variant)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Variant content */}
              {selectedVariantIndex !== null && (
                <div className="pt-2 border-t">
                  {renderVariantContent(selectedVariantIndex)}
                </div>
              )}

              {selectedVariantIndex === null && (
                <div className="py-4 text-center text-sm text-muted-foreground border border-dashed rounded-md">
                  Select a type to configure this field.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirmation dialog for variant switch */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Type?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing the type will replace the current value. This action cannot be undone.
              {pendingVariantIndex !== null && variants[pendingVariantIndex] && (
                <span className="block mt-2 font-medium">
                  New type: {getVariantLabel(variants[pendingVariantIndex])}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowConfirmDialog(false);
              setPendingVariantIndex(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingVariantIndex !== null && applyVariantChange(pendingVariantIndex)}
            >
              Change Type
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

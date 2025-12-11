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

  // For primitive values, match by type
  const valueType = typeof value;
  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    if (
      (valueType === 'string' && variant.type === 'string') ||
      (valueType === 'number' && (variant.type === 'integer' || variant.type === 'number')) ||
      (valueType === 'boolean' && variant.type === 'boolean') ||
      (Array.isArray(value) && variant.type === 'array')
    ) {
      return i;
    }
  }

  return null;
}

/**
 * Get the display label for a variant.
 * Prioritizes: variant_name (class name) > title > generic fallback
 */
function getVariantLabel(variant: UnionVariant): string {
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

  // Track previous value to detect external resets
  const prevValueRef = React.useRef(value);
  
  React.useEffect(() => {
    const prevValue = prevValueRef.current;
    prevValueRef.current = value;
    
    // Only re-detect variant if value was reset to null/undefined from a non-null value
    // This handles the "reset" case while preserving user selection during edits
    if ((value === null || value === undefined) && prevValue !== null && prevValue !== undefined) {
      setSelectedVariantIndex(null);
      return;
    }
    
    // On initial mount (when prevValue equals current value from initialization),
    // detect the variant from the initial value
    if (prevValue === value && selectedVariantIndex === null && value !== null && value !== undefined) {
      const detected = detectCurrentVariant(value, schema);
      if (detected !== null) {
        setSelectedVariantIndex(detected);
      }
    }
  }, [value, schema, selectedVariantIndex]);

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

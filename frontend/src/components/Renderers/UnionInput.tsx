import React from 'react';
import { AlertCircle, Layers, Check, ChevronRight, Folder, List, Hash, Type, ToggleLeft, Braces } from 'lucide-react';
import { Label } from '@/components/ui/label';
import FieldHelp from '@/components/FieldHelp';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { cn, createDefaultFromSchema, getValueWithDefault } from '@/lib/utils';
import { getFieldLabel, getFieldHelpText, getFieldSubtitle } from '@/lib/displayUtils';
import type { RendererProps } from './types';
import type { SchemaField, UnionVariant } from '@/types';
import { FieldRenderer } from '@/components/Renderers';
import { ClearResetButtons } from './ClearResetButtons';
import { useData } from '@/context/DataContext';

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

  // Try to detect by type matching using field key overlap scoring
  if (typeof value === 'object' && !Array.isArray(value)) {
    const valueKeys = new Set(Object.keys(value as Record<string, unknown>));
    
    // Score each object variant based on key overlap
    const objectVariants = variants
      .map((v, idx) => ({ variant: v, index: idx }))
      .filter(({ variant }) => variant.type === 'object' && variant.fields)
      .map(({ variant, index }) => {
        const variantKeys = new Set(Object.keys(variant.fields!));
        
        // Count keys that exist in both
        const matchingKeys = [...variantKeys].filter(k => valueKeys.has(k)).length;
        // Count value keys that are NOT in variant (extra keys)
        const extraKeys = [...valueKeys].filter(k => !variantKeys.has(k)).length;
        // Count variant keys that are NOT in value (missing keys)
        const missingKeys = [...variantKeys].filter(k => !valueKeys.has(k)).length;
        
        // Score: higher is better
        const score = matchingKeys * 2 - extraKeys - missingKeys;
        
        // Check if ALL value keys exist in variant (perfect subset)
        const isPerfectSubset = [...valueKeys].every(k => variantKeys.has(k));
        
        return { variant, index, score, matchingKeys, isPerfectSubset, variantKeys: variantKeys.size };
      })
      .filter(v => v.matchingKeys > 0); // Must have at least some overlap
    
    if (objectVariants.length > 0) {
      // Sort by: perfect subset first, then by score, then by fewer total keys (more specific)
      objectVariants.sort((a, b) => {
        if (a.isPerfectSubset !== b.isPerfectSubset) {
          return a.isPerfectSubset ? -1 : 1;
        }
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        return a.variantKeys - b.variantKeys;
      });
      
      return objectVariants[0].index;
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
    
    // For empty arrays, we CANNOT reliably distinguish between array variants
    // (e.g., list[int] vs list[str]) - return null so user must select
    if ((value as unknown[]).length === 0 && arrayVariants.length > 1) {
      return null;
    }
    
    // For non-empty arrays without type match, try depth match
    const depthMatch = arrayVariants.find(v => v.depth === valueDepth);
    if (depthMatch) {
      return depthMatch.index;
    }
    
    // Fall back to first array variant only if there's just one
    if (arrayVariants.length === 1) {
      return arrayVariants[0].index;
    }
    
    // Multiple array variants but can't determine which - return null
    return null;
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
 * Priority: card view override > display.title > variant_name (class name) > title > python_type > fallback
 * For objects: prefers ui_config label or class name for clarity
 * For arrays/primitives: uses python_type (e.g., 'list[str]', 'list[int]') for clarity
 */
function getVariantLabel(variant: UnionVariant): string {
  // Check for card view override first (union variants are displayed as cards)
  if (variant.ui_config?.display?.card?.title) {
    return variant.ui_config.display.card.title;
  }
  
  // Check ui_config display.title (from class_configs)
  if (variant.ui_config?.display?.title) {
    return variant.ui_config.display.title;
  }
  
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
 * Get icon for a variant based on its type.
 */
function getVariantIcon(variant: UnionVariant, isSelected: boolean): React.ReactNode {
  const colorClass = isSelected ? 'text-primary' : 'text-muted-foreground';
  
  switch (variant.type) {
    case 'object':
      return <Folder className={cn('h-5 w-5', colorClass)} />;
    case 'array':
      return <List className={cn('h-5 w-5', colorClass)} />;
    case 'string':
      return <Type className={cn('h-5 w-5', colorClass)} />;
    case 'integer':
    case 'number':
      return <Hash className={cn('h-5 w-5', colorClass)} />;
    case 'boolean':
      return <ToggleLeft className={cn('h-5 w-5', colorClass)} />;
    case 'union':
      return <Layers className={cn('h-5 w-5', colorClass)} />;
    default:
      return <Braces className={cn('h-5 w-5', colorClass)} />;
  }
}

/**
 * Check if a variant is a complex type that should navigate instead of inline edit.
 */
function isComplexVariant(variant: UnionVariant): boolean {
  return variant.type === 'object' || variant.type === 'array' || variant.type === 'union';
}

/**
 * Get a description/subtitle for a variant.
 * Priority: card view override > display.subtitle > description > auto-generated based on type
 */
function getVariantDescription(variant: UnionVariant): string {
  // Check for card view subtitle override first (union variants are displayed as cards)
  if (variant.ui_config?.display?.card?.subtitle) {
    return variant.ui_config.display.card.subtitle;
  }
  
  // Check for display.subtitle
  if (variant.ui_config?.display?.subtitle) {
    return variant.ui_config.display.subtitle;
  }
  
  if (variant.description) {
    return variant.description;
  }
  
  switch (variant.type) {
    case 'object':
      const fieldCount = variant.fields ? Object.keys(variant.fields).length : 0;
      return `Object with ${fieldCount} field${fieldCount !== 1 ? 's' : ''}`;
    case 'array':
      const itemType = variant.items?.python_type || variant.items?.type || 'items';
      return `List of ${itemType}`;
    case 'string':
      return 'Text value';
    case 'integer':
      return 'Integer number';
    case 'number':
      return 'Decimal number';
    case 'boolean':
      return 'True/False';
    case 'union':
      const variantCount = variant.variants?.length || 0;
      return `Union with ${variantCount} option${variantCount !== 1 ? 's' : ''}`;
    default:
      return variant.python_type || variant.type;
  }
}

/**
 * UnionInput component for rendering union/discriminated union fields.
 * 
 * Features:
 * - Card-based interface showing all variant options
 * - Navigation to complex types (objects, arrays, nested unions)
 * - Inline editing for primitive types
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
  const { setSelectedPath, expandPath, variantSelections, setVariantSelection } = useData();
  
  // Get stored variant selection if any (for ambiguous cases like empty arrays)
  const storedVariantIndex = variantSelections.get(path);
  
  // Compute effective value (use schema default if value is undefined)
  // This ensures default values for union fields are respected
  const effectiveValue = getValueWithDefault(value, schema, null);
  
  const [selectedVariantIndex, setSelectedVariantIndex] = React.useState<number | null>(() => {
    // First check if we have a stored selection (from previous user choice)
    if (storedVariantIndex !== undefined) {
      return storedVariantIndex;
    }
    // Otherwise try to detect from effective value (includes default)
    return detectCurrentVariant(effectiveValue, schema);
  });
  const [pendingVariantIndex, setPendingVariantIndex] = React.useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);

  const variants = schema.variants || [];
  const hasDiscriminator = !!schema.discriminator?.field;
  const discriminatorField = schema.discriminator?.field;
  
  const label = getFieldLabel(schema, name);
  const helpText = getFieldHelpText(schema);
  const subtitle = getFieldSubtitle(schema);

  // Get errors for this field
  const fieldErrors = React.useMemo(() => {
    if (!errors) return [];
    return errors.filter(e => e.path === path || e.path.startsWith(path + '.'));
  }, [errors, path]);

  const hasError = fieldErrors.length > 0;

  // Track previous path and value to detect navigation and resets
  const prevPathRef = React.useRef(path);
  const prevEffectiveValueRef = React.useRef(effectiveValue);
  
  React.useEffect(() => {
    const prevPath = prevPathRef.current;
    const prevEffectiveValue = prevEffectiveValueRef.current;
    prevPathRef.current = path;
    prevEffectiveValueRef.current = effectiveValue;
    
    // If the path changed, we navigated to a different field - re-detect variant
    if (prevPath !== path) {
      const detected = detectCurrentVariant(effectiveValue, schema);
      setSelectedVariantIndex(detected);
      return;
    }
    
    // If value was reset to null from a non-null value, clear selection
    // Note: We check raw value === null to detect explicit clearing
    if (value === null && prevEffectiveValue !== null && prevEffectiveValue !== undefined) {
      setSelectedVariantIndex(null);
      return;
    }
    
    // If we have a value but no selected variant, try to detect it
    // This handles cases where value changes externally (e.g., from parent component)
    if (selectedVariantIndex === null && effectiveValue !== null && effectiveValue !== undefined) {
      const detected = detectCurrentVariant(effectiveValue, schema);
      if (detected !== null) {
        setSelectedVariantIndex(detected);
      }
    }
  }, [path, value, effectiveValue, schema, selectedVariantIndex]);

  /**
   * Handle variant selection from card click.
   */
  const handleVariantSelect = (variantIndex: number, variant: UnionVariant) => {
    const isCurrentlySelected = selectedVariantIndex === variantIndex;
    
    if (isCurrentlySelected) {
      // Already selected - if complex type, navigate to its detail view
      if (isComplexVariant(variant)) {
        // For objects and arrays, we navigate TO this path so the detail panel 
        // shows the object's fields or array's items
        expandPath(path);
        setSelectedPath(path);
      }
      return;
    }
    
    // New variant selected
    // If there's existing data and it's different from the new variant, confirm
    if (value !== null && value !== undefined && selectedVariantIndex !== null) {
      setPendingVariantIndex(variantIndex);
      setShowConfirmDialog(true);
    } else {
      applyVariantChange(variantIndex, variant);
    }
  };

  /**
   * Apply the variant change, creating default data for the new variant.
   */
  const applyVariantChange = (newVariantIndex: number, variant?: UnionVariant) => {
    const newVariant = variant || variants[newVariantIndex];
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
    // Store the selection in context for ambiguous cases (e.g., empty arrays)
    setVariantSelection(path, newVariantIndex);
    onChange(newValue);
    setShowConfirmDialog(false);
    setPendingVariantIndex(null);
    
    // For OBJECT variants, navigate to the detail view after a short delay
    // to allow the data to be set first.
    // For ARRAY variants with empty arrays, DON'T auto-navigate because
    // the DetailPanel can't distinguish between different array types (e.g., list[int] vs list[str])
    // when the array is empty. User needs to click again to navigate.
    // For NESTED UNION variants, also don't auto-navigate - let user click again.
    if (newVariant.type === 'object') {
      setTimeout(() => {
        expandPath(path);
        setSelectedPath(path);
      }, 50);
    }
  };

  /**
   * Handle change within the current variant (for primitive types).
   */
  const handleVariantDataChange = (newData: unknown) => {
    onChange(newData);
  };

  /**
   * Render inline editor for primitive variants.
   */
  const renderPrimitiveEditor = (variant: UnionVariant) => {
    return (
      <div className="pt-4 border-t">
        <FieldRenderer
          name={variant.variant_name || name}
          path={path}
          schema={variant}
          value={value}
          errors={fieldErrors}
          disabled={disabled}
          onChange={handleVariantDataChange}
        />
      </div>
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

  // Get the currently selected variant
  const selectedVariant = selectedVariantIndex !== null ? variants[selectedVariantIndex] : null;
  const showPrimitiveEditor = selectedVariant && !isComplexVariant(selectedVariant);

  return (
    <div className="space-y-3">
      {/* Label */}
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <Label className={cn(hasError && 'text-destructive')}>
            <span className="inline-flex items-center gap-2">
              <span className="truncate">{label}</span>
              {schema.required && <span className="text-destructive">*</span>}
              <FieldHelp helpText={helpText} />
            </span>
          </Label>
          <Badge variant="outline" className="ml-auto text-xs">
            Union
          </Badge>
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground ml-6">{subtitle}</p>
        )}
      </div>

      {/* Clear/Reset buttons for optional union fields */}
      <ClearResetButtons
        schema={schema}
        value={value}
        onChange={(newValue) => {
          onChange(newValue);
          // Clear variant selection when clearing
          if (newValue === null) {
            setSelectedVariantIndex(null);
          } else if (newValue !== undefined) {
            // When resetting to default, try to detect the variant
            const detectedIdx = detectCurrentVariant(newValue, schema);
            setSelectedVariantIndex(detectedIdx);
          }
        }}
        disabled={disabled}
        variant="block"
        treatEmptyStringAsValue={true}
      />

      {/* help_text moved to FieldHelp next to title; description is shown where appropriate */}

      {/* Error display */}
      {hasError && fieldErrors[0]?.path === path && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {fieldErrors[0].message}
        </div>
      )}

      {/* Variant cards */}
      <div className="grid gap-2">
        {variants.map((variant, idx) => {
          const isSelected = selectedVariantIndex === idx;
          const variantLabel = variant.discriminator_values?.length
            ? variant.discriminator_values.join(' / ')
            : getVariantLabel(variant);
          const isComplex = isComplexVariant(variant);
          
          return (
            <Card
              key={idx}
              className={cn(
                'cursor-pointer transition-all',
                'hover:border-primary/50',
                isSelected && 'border-primary bg-primary/5 shadow-sm',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              onClick={() => !disabled && handleVariantSelect(idx, variant)}
            >
              <CardContent className="flex items-center gap-3 p-3">
                {/* Selection indicator */}
                <div className={cn(
                  'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                  isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                )}>
                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                
                {/* Icon */}
                <div className="flex-shrink-0">
                  {getVariantIcon(variant, isSelected)}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={cn(
                      'font-medium text-sm truncate',
                      isSelected && 'text-primary'
                    )}>
                      {variantLabel}
                    </h4>
                    {(variant.ui_config?.display?.card?.help_text || variant.ui_config?.display?.help_text) && (
                      <FieldHelp helpText={variant.ui_config.display.card?.help_text || variant.ui_config.display.help_text!} />
                    )}
                    {isSelected && isComplex && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        Selected
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {getVariantDescription(variant)}
                  </p>
                </div>

                {/* Type badge for object types */}
                {variant.type === 'object' && variant.variant_name && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {variant.variant_name}
                  </Badge>
                )}
                
                {/* Navigate arrow for complex types when selected */}
                {isSelected && isComplex && (
                  <ChevronRight className="h-5 w-5 text-primary shrink-0" />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Primitive editor (shown inline for simple types) */}
      {showPrimitiveEditor && selectedVariant && renderPrimitiveEditor(selectedVariant)}

      {/* Hint for unselected state */}
      {selectedVariantIndex === null && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Click a type above to select it
        </p>
      )}

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
              onClick={() => {
                if (pendingVariantIndex !== null) {
                  applyVariantChange(pendingVariantIndex, variants[pendingVariantIndex]);
                }
              }}
            >
              Change Type
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

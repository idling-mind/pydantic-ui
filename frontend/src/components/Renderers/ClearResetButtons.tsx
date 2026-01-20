import React from 'react';
import { X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SchemaField } from '@/types';

export interface ClearResetButtonsProps {
  schema: SchemaField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  /** 'inline' renders compact icon buttons, 'block' renders full-width buttons */
  variant?: 'inline' | 'block';
  className?: string;
  /** 
   * For union types: show Clear button whenever value is not null/undefined,
   * even if the value is an empty string. This allows clearing the variant selection.
   */
  treatEmptyStringAsValue?: boolean;
}

/**
 * Helper to check if a value equals the schema default
 * Deep comparison for objects/arrays
 */
function valueEqualsDefault(value: unknown, defaultValue: unknown): boolean {
  if (value === defaultValue) return true;
  if (value === undefined && defaultValue === null) return true;
  if (value === null && defaultValue === null) return true;
  if (value === undefined && defaultValue === undefined) return true;
  
  // Deep comparison for objects/arrays
  if (typeof value === 'object' && typeof defaultValue === 'object') {
    return JSON.stringify(value) === JSON.stringify(defaultValue);
  }
  
  return false;
}

/**
 * Helper to check if a field is optional (can be cleared to null)
 */
function isOptional(schema: SchemaField): boolean {
  return schema.required === false;
}

/**
 * Helper to check if a field has a meaningful default value
 * (not null, not undefined)
 */
function hasDefaultValue(schema: SchemaField): boolean {
  return schema.default !== undefined && schema.default !== null;
}

/**
 * ClearResetButtons component for optional fields and fields with defaults.
 * 
 * Shows:
 * - Clear button: For optional fields when there's a displayed value (clears to null)
 * - Reset button: For fields with defaults when the current state differs from default
 */
export function ClearResetButtons({
  schema,
  value,
  onChange,
  disabled,
  variant = 'inline',
  className,
  treatEmptyStringAsValue = false,
}: ClearResetButtonsProps) {
  const optional = isOptional(schema);
  const hasDefault = hasDefaultValue(schema);
  
  // The displayed value is what the user sees:
  // - If value is null (cleared), display is empty
  // - If value is undefined but has default, display shows the default
  // - If value is defined, display shows the value
  const displayedValue = value === null ? null : (value === undefined && hasDefault ? schema.default : value);
  
  // For unions: empty string is still a "value" (variant was selected)
  // For regular fields: empty string is treated as empty
  const isDisplayEmpty = treatEmptyStringAsValue
    ? displayedValue === null || displayedValue === undefined
    : displayedValue === null || displayedValue === undefined || displayedValue === '';
  
  // Check if the raw value equals the default (for reset logic)
  // undefined means "use default", so it equals default
  // null means "cleared", which does NOT equal a non-null default
  const rawValueEqualsDefault = hasDefault && (
    value === undefined || // undefined means using default
    valueEqualsDefault(value, schema.default)
  );
  
  // Determine which buttons to show
  // Clear: show when optional AND there's something displayed (not empty)
  // This allows clearing when: value is set, OR value is undefined but default is shown
  const showClear = optional && !isDisplayEmpty;
  
  // Reset: show when:
  // - Has default value
  // - Raw value does NOT equal default (either explicit different value, or null/cleared)
  // This allows resetting when:
  // - User entered a different value than default
  // - User cleared the field (value is null) but there's a default to restore
  const showReset = hasDefault && !rawValueEqualsDefault;
  
  // Don't render anything if no buttons needed
  if (!showClear && !showReset) {
    return null;
  }

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(null);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Deep clone the default value to avoid mutations
    const defaultValue = schema.default !== undefined 
      ? JSON.parse(JSON.stringify(schema.default))
      : null;
    onChange(defaultValue);
  };

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-0.5', className)}>
        {showClear && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={handleClear}
            disabled={disabled}
            title="Clear value (set to empty)"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear value</span>
          </Button>
        )}
        {showReset && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            onClick={handleReset}
            disabled={disabled}
            title={`Reset to default: ${JSON.stringify(schema.default)}`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="sr-only">Reset to default</span>
          </Button>
        )}
      </div>
    );
  }

  // Block variant - full width buttons
  return (
    <div className={cn('flex gap-2', className)}>
      {showClear && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 text-destructive hover:text-destructive"
          onClick={handleClear}
          disabled={disabled}
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
      {showReset && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleReset}
          disabled={disabled}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset to default
        </Button>
      )}
    </div>
  );
}

/**
 * Hook to get clear/reset button props and handlers
 * Useful for components that need more control over rendering
 */
export function useClearResetButtons(
  schema: SchemaField,
  value: unknown,
  onChange: (value: unknown) => void
) {
  const optional = isOptional(schema);
  const hasDefault = hasDefaultValue(schema);
  
  // The displayed value is what the user sees
  const displayedValue = value === null ? null : (value === undefined && hasDefault ? schema.default : value);
  const isDisplayEmpty = displayedValue === null || displayedValue === undefined || displayedValue === '';
  
  // Check if the raw value equals the default
  const rawValueEqualsDefault = hasDefault && (
    value === undefined || 
    valueEqualsDefault(value, schema.default)
  );
  
  const showClear = optional && !isDisplayEmpty;
  const showReset = hasDefault && !rawValueEqualsDefault;

  const handleClear = React.useCallback(() => {
    onChange(null);
  }, [onChange]);

  const handleReset = React.useCallback(() => {
    const defaultValue = schema.default !== undefined 
      ? JSON.parse(JSON.stringify(schema.default))
      : null;
    onChange(defaultValue);
  }, [onChange, schema.default]);

  return {
    showClear,
    showReset,
    handleClear,
    handleReset,
    defaultValue: schema.default,
  };
}

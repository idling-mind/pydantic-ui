import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import FieldHelp from '@/components/FieldHelp';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, getValueWithDefault, resolveOptionsFromData } from '@/lib/utils';
import { getFieldLabel, getFieldHelpText, getFieldSubtitle } from '@/lib/displayUtils';
import { useData } from '@/context/DataContext';
import { ClearResetButtons } from './ClearResetButtons';
import type { RendererProps } from './types';

export function ChecklistInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const { data } = useData();
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = getFieldLabel(schema, name);
  const helpText = getFieldHelpText(schema);
  const subtitle = getFieldSubtitle(schema);
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Track last clicked index for shift-click range selection
  const lastClickedIndexRef = React.useRef<number | null>(null);
  // Track if shift was held during click (captured on mousedown)
  const shiftKeyRef = React.useRef<boolean>(false);
  
  // Use default value from schema if value is undefined/null
  const effectiveValue = getValueWithDefault<unknown[]>(value, schema, []);
  
  // Get options from enum, literal values, custom options, or data source
  // For array fields, the options usually come from the items schema (if it's an enum)
  // or from the field itself if it has options defined
  const options: { value: string; label: string }[] = React.useMemo(() => {
    if (schema.ui_config?.options_from) {
      return resolveOptionsFromData(schema.ui_config.options_from, data);
    }
    
    if (props.options && Array.isArray(props.options)) {
      return (props.options as Array<string | { value: string; label: string }>).map((opt) =>
        typeof opt === 'string' ? { value: opt, label: opt } : opt
      );
    }
    
    // Check items schema for enum
    const itemsSchema = schema.items;
    if (itemsSchema) {
        if (itemsSchema.enum) {
            return itemsSchema.enum.map((val: unknown) => ({
                value: String(val),
                label: String(val),
            }));
        }
        if (itemsSchema.literal_values) {
            return itemsSchema.literal_values.map((val: unknown) => ({
                value: String(val),
                label: String(val),
            }));
        }
    }

    return [];
  }, [schema.items, props.options, schema.ui_config?.options_from, data]);

  // Select All handler
  const handleSelectAll = () => {
    const allValues = options.map(opt => opt.value);
    onChange(allValues);
  };

  // Unselect All handler
  const handleUnselectAll = () => {
    onChange([]);
  };

  // Check if all are selected
  const allSelected = options.length > 0 && 
    options.every(opt => Array.isArray(effectiveValue) && effectiveValue.some(v => String(v) === opt.value));
  const noneSelected = !Array.isArray(effectiveValue) || effectiveValue.length === 0;

  const handleCheckedChange = (checked: boolean, optionValue: string, index: number) => {
    const currentValues = Array.isArray(effectiveValue) ? [...effectiveValue] : [];
    const isShiftClick = shiftKeyRef.current;
    
    // Handle shift-click range selection
    if (isShiftClick && lastClickedIndexRef.current !== null && lastClickedIndexRef.current !== index) {
      const start = Math.min(lastClickedIndexRef.current, index);
      const end = Math.max(lastClickedIndexRef.current, index);
      const rangeOptions = options.slice(start, end + 1).map(opt => opt.value);
      
      if (checked) {
        // Add all options in range that aren't already selected
        const newValues = [...currentValues];
        for (const optVal of rangeOptions) {
          if (!newValues.includes(optVal)) {
            newValues.push(optVal);
          }
        }
        onChange(newValues);
      } else {
        // Remove all options in range
        onChange(currentValues.filter(v => !rangeOptions.includes(String(v))));
      }
    } else {
      // Normal single item toggle
      if (checked) {
        if (!currentValues.includes(optionValue)) {
          onChange([...currentValues, optionValue]);
        }
      } else {
        onChange(currentValues.filter((v) => String(v) !== optionValue));
      }
    }
    
    // Update last clicked index
    lastClickedIndexRef.current = index;
    // Reset shift key ref
    shiftKeyRef.current = false;
  };

  return (
    <div className="space-y-3" data-pydantic-ui="field" data-pydantic-ui-field-type="checklist" data-pydantic-ui-path={path}>
      <div className="space-y-0.5">
        <Label className={cn(hasError && 'text-destructive')} data-pydantic-ui="field-label">
          <span className="inline-flex items-center gap-2">
            <span className="truncate">{label}</span>
            {schema.required !== false && <span className="text-destructive ml-1">*</span>}
            <FieldHelp helpText={helpText} />
          </span>
        </Label>
        {subtitle && (
          <p className="text-xs text-muted-foreground" data-pydantic-ui="field-subtitle">{subtitle}</p>
        )}
      </div>
      <ClearResetButtons
        schema={schema}
        value={value}
        onChange={onChange}
        disabled={isReadOnly}
        variant="block"
      />
      {/* Select All / Unselect All buttons */}
      {options.length > 1 && (
        <div className="flex gap-2 pb-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={isReadOnly || allSelected}
            className="text-xs h-7"
          >
            Select All
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUnselectAll}
            disabled={isReadOnly || noneSelected}
            className="text-xs h-7"
          >
            Unselect All
          </Button>
          <span className="text-xs text-muted-foreground self-center ml-2">
            {Array.isArray(effectiveValue) ? effectiveValue.length : 0} / {options.length} selected
          </span>
        </div>
      )}
      {options.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Tip: Hold Shift and click to select a range
        </p>
      )}
      <div className="flex flex-col space-y-2">
        {options.map((opt, index) => {
          const isChecked = Array.isArray(effectiveValue) && effectiveValue.some(v => String(v) === opt.value);
          return (
            <div key={opt.value} className="flex items-center space-x-2">
              <Checkbox
                id={`${path}-${opt.value}`}
                checked={isChecked}
                onPointerDown={(e: React.PointerEvent) => {
                  // Capture shift key state before the change event fires
                  shiftKeyRef.current = e.shiftKey;
                }}
                onCheckedChange={(checked) => handleCheckedChange(checked === true, opt.value, index)}
                disabled={isReadOnly}
                data-pydantic-ui="field-control"
              />
              <Label htmlFor={`${path}-${opt.value}`} className="font-normal cursor-pointer">
                {opt.label}
              </Label>
            </div>
          );
        })}
      </div>
      {/* description now shown as subtitle above, help_text shown via FieldHelp */}
      {hasError && (
        <p className="text-xs text-destructive">{errors[0].message}</p>
      )}
    </div>
  );
}

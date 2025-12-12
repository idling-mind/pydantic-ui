import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, getValueWithDefault } from '@/lib/utils';
import type { RendererProps } from './types';

export function ChecklistInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = schema.ui_config?.label || schema.title || name;
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema if value is undefined/null
  const effectiveValue = getValueWithDefault<any[]>(value, schema, []);
  
  // Get options from enum, literal values, or custom options
  // For array fields, the options usually come from the items schema (if it's an enum)
  // or from the field itself if it has options defined
  const options: { value: string; label: string }[] = React.useMemo(() => {
    if (props.options && Array.isArray(props.options)) {
      return (props.options as Array<string | { value: string; label: string }>).map((opt) =>
        typeof opt === 'string' ? { value: opt, label: opt } : opt
      );
    }
    
    // Check items schema for enum
    const itemsSchema = schema.items;
    if (itemsSchema) {
        if (itemsSchema.enum) {
            return itemsSchema.enum.map((val: any) => ({
                value: String(val),
                label: String(val),
            }));
        }
        if (itemsSchema.literal_values) {
            return itemsSchema.literal_values.map((val: any) => ({
                value: String(val),
                label: String(val),
            }));
        }
    }

    return [];
  }, [schema.items, props.options]);

  const handleCheckedChange = (checked: boolean, optionValue: string) => {
    const currentValues = Array.isArray(effectiveValue) ? [...effectiveValue] : [];
    
    if (checked) {
      if (!currentValues.includes(optionValue)) {
        onChange([...currentValues, optionValue]);
      }
    } else {
      onChange(currentValues.filter((v) => String(v) !== optionValue));
    }
  };

  return (
    <div className="space-y-3">
      <Label className={cn(hasError && 'text-destructive')}>
        {label}
        {schema.required !== false && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="flex flex-col space-y-2">
        {options.map((opt) => {
          const isChecked = Array.isArray(effectiveValue) && effectiveValue.some(v => String(v) === opt.value);
          return (
            <div key={opt.value} className="flex items-center space-x-2">
              <Checkbox
                id={`${path}-${opt.value}`}
                checked={isChecked}
                onCheckedChange={(checked) => handleCheckedChange(checked === true, opt.value)}
                disabled={isReadOnly}
              />
              <Label htmlFor={`${path}-${opt.value}`} className="font-normal cursor-pointer">
                {opt.label}
              </Label>
            </div>
          );
        })}
      </div>
      {schema.description && (
        <p className="text-xs text-muted-foreground">{schema.description}</p>
      )}
      {schema.ui_config?.help_text && (
        <p className="text-xs text-muted-foreground">{schema.ui_config.help_text}</p>
      )}
      {hasError && (
        <p className="text-xs text-destructive">{errors[0].message}</p>
      )}
    </div>
  );
}

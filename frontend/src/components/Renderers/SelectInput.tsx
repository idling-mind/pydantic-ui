import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn, getValueWithDefault } from '@/lib/utils';
import type { RendererProps } from './types';

export function SelectInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = schema.ui_config?.label || schema.title || name;
  const placeholder = (props.placeholder as string) || `Select ${label.toLowerCase()}`;
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema if value is undefined/null
  const effectiveValue = getValueWithDefault<string | null>(value, schema, null);
  
  // Get options from enum, literal values, or custom options
  const options: { value: string; label: string }[] = React.useMemo(() => {
    if (props.options && Array.isArray(props.options)) {
      return (props.options as Array<string | { value: string; label: string }>).map((opt) =>
        typeof opt === 'string' ? { value: opt, label: opt } : opt
      );
    }
    if (schema.enum) {
      return schema.enum.map((val) => ({
        value: String(val),
        label: String(val),
      }));
    }
    if (schema.literal_values) {
      return schema.literal_values.map((val) => ({
        value: String(val),
        label: String(val),
      }));
    }
    return [];
  }, [schema.enum, schema.literal_values, props.options]);

  return (
    <div className="space-y-2">
      <Label htmlFor={path} className={cn(hasError && 'text-destructive')}>
        {label}
        {schema.required !== false && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select
        value={effectiveValue !== null && effectiveValue !== undefined ? String(effectiveValue) : undefined}
        onValueChange={(val) => onChange(val)}
        disabled={isReadOnly}
      >
        <SelectTrigger
          id={path}
          className={cn(hasError && 'border-destructive focus:ring-destructive', isReadOnly && 'bg-muted cursor-not-allowed')}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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

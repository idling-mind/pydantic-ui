import React from 'react';
import { Label } from '@/components/ui/label';
import FieldHelp from '@/components/FieldHelp';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn, getValueWithDefault, resolveOptionsFromData } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { ClearResetButtons } from './ClearResetButtons';
import type { RendererProps } from './types';

export function RadioGroupInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const { data } = useData();
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = schema.ui_config?.label || schema.title || name;
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema if value is undefined (not null - null means cleared)
  const effectiveValue = getValueWithDefault<string | null>(value, schema, null);
  
  // Use a key that changes when the value becomes null to force RadioGroup to remount
  // This fixes the issue where clearing doesn't properly update the UI
  const radioGroupKey = value === null ? `${path}-cleared` : path;
  
  // Get options from enum, literal values, custom options, or data source
  const options: { value: string; label: string }[] = React.useMemo(() => {
    if (schema.ui_config?.options_from) {
      return resolveOptionsFromData(schema.ui_config.options_from, data);
    }
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
  }, [schema.enum, schema.literal_values, props.options, schema.ui_config?.options_from, data]);

  return (
    <div className="space-y-3">
      <Label className={cn(hasError && 'text-destructive')}>
        <span className="inline-flex items-center gap-2">
          <span className="truncate">{label}</span>
          {schema.required !== false && <span className="text-destructive ml-1">*</span>}
          <FieldHelp helpText={schema.ui_config?.help_text} />
        </span>
      </Label>
      <ClearResetButtons
        schema={schema}
        value={value}
        onChange={onChange}
        disabled={isReadOnly}
        variant="block"
      />
      <RadioGroup
        key={radioGroupKey}
        value={effectiveValue !== null && effectiveValue !== undefined ? String(effectiveValue) : ''}
        onValueChange={(val) => onChange(val)}
        disabled={isReadOnly}
        className="flex flex-col space-y-1"
      >
        {options.map((opt) => (
          <div key={opt.value} className="flex items-center space-x-2">
            <RadioGroupItem value={opt.value} id={`${path}-${opt.value}`} />
            <Label htmlFor={`${path}-${opt.value}`} className="font-normal cursor-pointer">
              {opt.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
      {schema.description && (
        <p className="text-xs text-muted-foreground">{schema.description}</p>
      )}
      {/* help_text now shown via FieldHelp next to title */}
      {hasError && (
        <p className="text-xs text-destructive">{errors[0].message}</p>
      )}
    </div>
  );
}

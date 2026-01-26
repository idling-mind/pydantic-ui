import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import FieldHelp from '@/components/FieldHelp';
import { cn, getValueWithDefault, resolveOptionsFromData } from '@/lib/utils';
import { getFieldLabel, getFieldHelpText, getFieldSubtitle } from '@/lib/displayUtils';
import { useData } from '@/context/DataContext';
import { ClearResetButtons } from './ClearResetButtons';
import type { RendererProps } from './types';

export function SelectInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const { data } = useData();
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = getFieldLabel(schema, name);
  const helpText = getFieldHelpText(schema);
  const subtitle = getFieldSubtitle(schema);
  const placeholder = schema.ui_config?.placeholder || (props.placeholder as string) || `Select ${label.toLowerCase()}`;
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema if value is undefined (not null - null means cleared)
  const effectiveValue = getValueWithDefault<string | null>(value, schema, null);
  
  // Use a key that changes when the value becomes null/undefined to force Select to remount
  // This fixes the issue where clearing doesn't properly update the UI
  const selectKey = value === null ? `${path}-cleared` : path;
  
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
    <div className="space-y-2">
      <div className="space-y-0.5">
        <Label htmlFor={path} className={cn(hasError && 'text-destructive')}>
          <span className="inline-flex items-center gap-2">
            <span className="truncate">{label}</span>
            {schema.required !== false && <span className="text-destructive ml-1">*</span>}
            <FieldHelp helpText={helpText} />
          </span>
        </Label>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Select
          key={selectKey}
          value={effectiveValue !== null && effectiveValue !== undefined ? String(effectiveValue) : ''}
          onValueChange={(val) => onChange(val)}
          disabled={isReadOnly}
        >
          <SelectTrigger
            id={path}
            className={cn('flex-1', hasError && 'border-destructive focus:ring-destructive', isReadOnly && 'bg-muted cursor-not-allowed')}
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
        <ClearResetButtons
          schema={schema}
          value={value}
          onChange={onChange}
          disabled={isReadOnly}
          variant="inline"
        />
      </div>
      {/* help_text now shown via FieldHelp next to title */}
      {hasError && (
        <p className="text-xs text-destructive">{errors[0].message}</p>
      )}
    </div>
  );
}

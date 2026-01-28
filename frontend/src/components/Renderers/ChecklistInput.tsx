import React from 'react';
import { Label } from '@/components/ui/label';
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

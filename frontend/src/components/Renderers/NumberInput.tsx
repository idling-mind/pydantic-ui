import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FieldHelp from '@/components/FieldHelp';
import { cn, getValueWithDefault } from '@/lib/utils';
import { getFieldLabel, getFieldHelpText, getFieldSubtitle } from '@/lib/displayUtils';
import { ClearResetButtons } from './ClearResetButtons';
import type { RendererProps } from './types';

export function NumberInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = getFieldLabel(schema, name);
  const helpText = getFieldHelpText(schema);
  const subtitle = getFieldSubtitle(schema);
  const step = props.step as number | undefined;
  const min = schema.minimum ?? schema.exclusive_minimum;
  const max = schema.maximum ?? schema.exclusive_maximum;
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema if value is undefined/null
  const effectiveValue = getValueWithDefault<number | null>(value, schema, null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      onChange(null);
    } else {
      const num = schema.type === 'integer' ? parseInt(val, 10) : parseFloat(val);
      if (!isNaN(num)) {
        onChange(num);
      }
    }
  };

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
        <Input
          id={path}
          type="number"
          value={effectiveValue !== null && effectiveValue !== undefined ? String(effectiveValue) : ''}
          onChange={handleChange}
          placeholder={`Enter ${label.toLowerCase()}`}
          disabled={isReadOnly}
          readOnly={isReadOnly}
          step={step || (schema.type === 'integer' ? 1 : 'any')}
          min={min}
          max={max}
          className={cn('flex-1', hasError && 'border-destructive focus-visible:ring-destructive', isReadOnly && 'bg-muted cursor-not-allowed')}
        />
        <ClearResetButtons
          schema={schema}
          value={value}
          onChange={onChange}
          disabled={isReadOnly}
          variant="inline"
        />
      </div>
      {/* description now shown as subtitle above, help_text shown via FieldHelp */}
      {hasError && (
        <p className="text-xs text-destructive">{errors[0].message}</p>
      )}
      {(min !== undefined || max !== undefined) && (
        <p className="text-xs text-muted-foreground">
          {min !== undefined && max !== undefined
            ? `Range: ${min} - ${max}`
            : min !== undefined
            ? `Min: ${min}`
            : `Max: ${max}`}
        </p>
      )}
    </div>
  );
}

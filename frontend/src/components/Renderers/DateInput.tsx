import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { RendererProps } from './types';

export function DateInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = schema.ui_config?.label || schema.title || name;
  const includeTime = (props.includeTime as boolean) || schema.format === 'date-time';

  // Format date for input
  const formatValue = (val: unknown): string => {
    if (!val) return '';
    const date = new Date(val as string);
    if (isNaN(date.getTime())) return '';
    
    if (includeTime) {
      return date.toISOString().slice(0, 16);
    }
    return date.toISOString().slice(0, 10);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      onChange(null);
    } else {
      // Send ISO format
      const date = new Date(val);
      onChange(date.toISOString());
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={path} className={cn(hasError && 'text-destructive')}>
        {label}
        {schema.required !== false && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={path}
        type={includeTime ? 'datetime-local' : 'date'}
        value={formatValue(value)}
        onChange={handleChange}
        disabled={disabled}
        className={cn(hasError && 'border-destructive focus-visible:ring-destructive')}
      />
      {schema.description && (
        <p className="text-xs text-muted-foreground">{schema.description}</p>
      )}
      {hasError && (
        <p className="text-xs text-destructive">{errors[0].message}</p>
      )}
    </div>
  );
}

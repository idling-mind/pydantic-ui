import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FieldHelp from '@/components/FieldHelp';
import { cn, getValueWithDefault } from '@/lib/utils';
import { getFieldLabel, getFieldHelpText, getFieldSubtitle } from '@/lib/displayUtils';
import { ClearResetButtons } from './ClearResetButtons';
import type { RendererProps } from './types';

type ColorFormat = 'hex' | 'rgb' | 'hsl';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function ColorInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = getFieldLabel(schema, name);
  const helpText = getFieldHelpText(schema);
  const subtitle = getFieldSubtitle(schema);
  const format = (props.format as ColorFormat) || 'hex';
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema if value is undefined/null
  const effectiveValue = getValueWithDefault<string>(value, schema, '#000000');

  const [displayValue, setDisplayValue] = React.useState<string>('');

  // Convert value to hex for the color picker
  const toHex = (val: unknown): string => {
    if (!val) return '#000000';
    const strVal = String(val);
    
    if (strVal.startsWith('#')) {
      return strVal;
    }
    
    // Handle rgb(r, g, b)
    const rgbMatch = strVal.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i);
    if (rgbMatch) {
      return rgbToHex(
        parseInt(rgbMatch[1]),
        parseInt(rgbMatch[2]),
        parseInt(rgbMatch[3])
      );
    }
    
    return '#000000';
  };

  // Format output based on format prop
  const formatOutput = (hex: string): string => {
    switch (format) {
      case 'rgb': {
        const rgb = hexToRgb(hex);
        if (rgb) {
          return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        }
        return hex;
      }
      case 'hsl':
        // Basic HSL conversion (simplified)
        return hex; // TODO: implement HSL conversion
      case 'hex':
      default:
        return hex;
    }
  };

  React.useEffect(() => {
    setDisplayValue(effectiveValue ? String(effectiveValue) : '');
  }, [effectiveValue]);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    const formatted = formatOutput(hex);
    setDisplayValue(formatted);
    onChange(formatted);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(e.target.value);
    onChange(e.target.value || null);
  };

  return (
    <div className="space-y-2" data-pydantic-ui="field" data-pydantic-ui-field-type="color" data-pydantic-ui-path={path}>
      <div className="space-y-0.5">
        <Label htmlFor={path} className={cn(hasError && 'text-destructive')} data-pydantic-ui="field-label">
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
      <div className="flex gap-2 items-center">
        <Input
          type="color"
          value={toHex(effectiveValue)}
          onChange={handleColorChange}
          disabled={isReadOnly}
          className={cn('w-12 h-10 p-1 cursor-pointer', isReadOnly && 'cursor-not-allowed')}
          data-pydantic-ui="field-control"
        />
        <Input
          id={path}
          type="text"
          value={displayValue}
          onChange={handleTextChange}
          placeholder="#000000"
          disabled={isReadOnly}
          readOnly={isReadOnly}
          className={cn(
            'flex-1 font-mono',
            hasError && 'border-destructive focus-visible:ring-destructive',
            isReadOnly && 'bg-muted cursor-not-allowed'
          )}
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
    </div>
  );
}

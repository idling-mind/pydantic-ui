import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, getValueWithDefault } from '@/lib/utils';
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
  const label = schema.ui_config?.label || schema.title || name;
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
    <div className="space-y-2">
      <Label htmlFor={path} className={cn(hasError && 'text-destructive')}>
        {label}
        {schema.required !== false && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="flex gap-2">
        <Input
          type="color"
          value={toHex(effectiveValue)}
          onChange={handleColorChange}
          disabled={isReadOnly}
          className={cn('w-12 h-10 p-1 cursor-pointer', isReadOnly && 'cursor-not-allowed')}
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

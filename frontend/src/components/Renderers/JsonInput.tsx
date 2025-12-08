import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { RendererProps } from './types';

export function JsonInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const props = schema.ui_config?.props || {};
  const label = schema.ui_config?.label || schema.title || name;
  const rows = (props.rows as number) || 8;

  const [textValue, setTextValue] = React.useState('');
  const [parseError, setParseError] = React.useState<string | null>(null);

  // Format JSON for display
  React.useEffect(() => {
    if (value !== undefined && value !== null) {
      try {
        setTextValue(JSON.stringify(value, null, 2));
        setParseError(null);
      } catch {
        setTextValue(String(value));
      }
    } else {
      setTextValue('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setTextValue(text);

    if (!text.trim()) {
      setParseError(null);
      onChange(null);
      return;
    }

    try {
      const parsed = JSON.parse(text);
      setParseError(null);
      onChange(parsed);
    } catch (err) {
      setParseError((err as Error).message);
    }
  };

  const combinedErrors = [
    ...(errors || []),
    ...(parseError ? [{ path, message: `Invalid JSON: ${parseError}` }] : []),
  ];
  const hasErrors = combinedErrors.length > 0;

  return (
    <div className="space-y-2">
      <Label htmlFor={path} className={cn(hasErrors && 'text-destructive')}>
        {label}
        {schema.required !== false && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Textarea
        id={path}
        value={textValue}
        onChange={handleChange}
        placeholder='{"key": "value"}'
        disabled={disabled}
        rows={rows}
        className={cn(
          'font-mono text-sm',
          hasErrors && 'border-destructive focus-visible:ring-destructive'
        )}
      />
      {schema.description && (
        <p className="text-xs text-muted-foreground">{schema.description}</p>
      )}
      {schema.ui_config?.help_text && (
        <p className="text-xs text-muted-foreground">{schema.ui_config.help_text}</p>
      )}
      {hasErrors && (
        <p className="text-xs text-destructive">{combinedErrors[0].message}</p>
      )}
    </div>
  );
}

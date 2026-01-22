import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import FieldHelp from '@/components/FieldHelp';
import { cn, getValueWithDefault } from '@/lib/utils';
import type { RendererProps } from './types';

export function JsonInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const props = schema.ui_config?.props || {};
  const label = schema.ui_config?.label || schema.title || name;
  const rows = (props.rows as number) || 8;
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema if value is undefined/null
  const effectiveValue = getValueWithDefault(value, schema, null);

  const [textValue, setTextValue] = React.useState('');
  const [parseError, setParseError] = React.useState<string | null>(null);

  // Format JSON for display
  React.useEffect(() => {
    if (effectiveValue !== undefined && effectiveValue !== null) {
      try {
        setTextValue(JSON.stringify(effectiveValue, null, 2));
        setParseError(null);
      } catch {
        setTextValue(String(effectiveValue));
      }
    } else {
      setTextValue('');
    }
  }, [effectiveValue]);

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
        <span className="inline-flex items-center gap-2">
          <span className="truncate">{label}</span>
          {schema.required !== false && <span className="text-destructive ml-1">*</span>}
          <FieldHelp helpText={schema.ui_config?.help_text} />
        </span>
      </Label>
      <Textarea
        id={path}
        value={textValue}
        onChange={handleChange}
        placeholder='{"key": "value"}'
        disabled={isReadOnly}
        readOnly={isReadOnly}
        rows={rows}
        className={cn(
          'font-mono text-sm',
          hasErrors && 'border-destructive focus-visible:ring-destructive',
          isReadOnly && 'bg-muted cursor-not-allowed'
        )}
      />
      {schema.description && (
        <p className="text-xs text-muted-foreground">{schema.description}</p>
      )}
      {/* help_text now shown via FieldHelp next to title */}
      {hasErrors && (
        <p className="text-xs text-destructive">{combinedErrors[0].message}</p>
      )}
    </div>
  );
}

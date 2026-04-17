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
  const label = getFieldLabel(schema, name);
  const helpText = getFieldHelpText(schema);
  const subtitle = getFieldSubtitle(schema);
  const min = schema.minimum ?? schema.exclusive_minimum;
  const max = schema.maximum ?? schema.exclusive_maximum;
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema if value is undefined/null
  const effectiveValue = getValueWithDefault<number | null>(value, schema, null) as number | null;

  const formatValue = React.useCallback(
    (nextValue: number | null | undefined): string =>
      nextValue !== null && nextValue !== undefined ? String(nextValue) : '',
    [],
  );

  // Keep a text draft while typing so values like "0.0" are not collapsed to "0" mid-edit.
  const [inputValue, setInputValue] = React.useState<string>(() => formatValue(effectiveValue));
  const lastSyncedValueRef = React.useRef<string>(formatValue(effectiveValue));

  React.useEffect(() => {
    const nextFormattedValue = formatValue(effectiveValue);
    if (nextFormattedValue !== lastSyncedValueRef.current) {
      setInputValue(nextFormattedValue);
      lastSyncedValueRef.current = nextFormattedValue;
    }
  }, [effectiveValue, formatValue]);

  const validationMessage = React.useMemo(() => {
    if (inputValue.trim() === '') {
      return null;
    }

    if (schema.type === 'integer') {
      if (!/^-?\d+$/.test(inputValue.trim())) {
        return 'Enter a whole number.';
      }

      const parsedInt = Number.parseInt(inputValue, 10);
      if (!Number.isFinite(parsedInt)) {
        return 'Enter a valid number.';
      }
      if (min !== undefined && parsedInt < min) {
        return `Must be >= ${min}.`;
      }
      if (max !== undefined && parsedInt > max) {
        return `Must be <= ${max}.`;
      }
      return null;
    }

    const parsedFloat = Number(inputValue);
    if (!Number.isFinite(parsedFloat)) {
      return 'Enter a valid number.';
    }
    if (min !== undefined && parsedFloat < min) {
      return `Must be >= ${min}.`;
    }
    if (max !== undefined && parsedFloat > max) {
      return `Must be <= ${max}.`;
    }

    return null;
  }, [inputValue, max, min, schema.type]);

  const hasInlineValidationError = validationMessage !== null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    if (val === '') {
      onChange(null);
    } else {
      if (schema.type === 'integer') {
        if (!/^-?\d+$/.test(val.trim())) {
          return;
        }
        const intVal = Number.parseInt(val, 10);
        if (!Number.isNaN(intVal)) {
          onChange(intVal);
        }
        return;
      }

      const floatVal = Number(val);
      if (!Number.isNaN(floatVal) && Number.isFinite(floatVal)) {
        onChange(floatVal);
      }
    }
  };

  return (
    <div className="space-y-2" data-pydantic-ui="field" data-pydantic-ui-field-type="number" data-pydantic-ui-path={path}>
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
      <div className="flex items-center gap-1">
        <Input
          id={path}
          type="text"
          inputMode={schema.type === 'integer' ? 'numeric' : 'decimal'}
          value={inputValue}
          onChange={handleChange}
          placeholder={`Enter ${label.toLowerCase()}`}
          disabled={isReadOnly}
          readOnly={isReadOnly}
          data-pydantic-ui="field-control"
          aria-invalid={hasError || hasInlineValidationError}
          className={cn(
            'flex-1',
            (hasError || hasInlineValidationError) && 'border-destructive focus-visible:ring-destructive',
            isReadOnly && 'bg-muted cursor-not-allowed',
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
      {hasInlineValidationError && (
        <p className="text-xs text-destructive">{validationMessage}</p>
      )}
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

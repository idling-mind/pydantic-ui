
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, getValueWithDefault } from '@/lib/utils';
import { ClearResetButtons } from './ClearResetButtons';
import type { RendererProps } from './types';

export function TextInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = schema.ui_config?.label || schema.title || name;
  const placeholder = props.placeholder as string | undefined;
  const maxLength = schema.max_length;
  const minLength = schema.min_length;
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema only if value is undefined/null
  // Important: empty string "" is a valid value and should NOT fall back to default
  const effectiveValue = (value !== undefined && value !== null) 
    ? value 
    : getValueWithDefault<string>(value, schema, '');

  return (
    <div className="space-y-2">
      <Label htmlFor={path} className={cn(hasError && 'text-destructive')}>
        {label}
        {schema.required !== false && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="flex items-center gap-1">
        <Input
          id={path}
          type="text"
          value={(effectiveValue as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || `Enter ${label.toLowerCase()}`}
          disabled={isReadOnly}
          readOnly={isReadOnly}
          maxLength={maxLength}
          minLength={minLength}
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
      {schema.description && (
        <p className="text-xs text-muted-foreground">{schema.description}</p>
      )}
      {schema.ui_config?.help_text && (
        <p className="text-xs text-muted-foreground">{schema.ui_config.help_text}</p>
      )}
      {hasError && (
        <p className="text-xs text-destructive">{errors[0].message}</p>
      )}
      {maxLength && (
        <p className="text-xs text-muted-foreground text-right">
          {((effectiveValue as string) || '').length} / {maxLength}
        </p>
      )}
    </div>
  );
}

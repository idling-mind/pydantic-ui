
import { Textarea as TextareaComponent } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn, getValueWithDefault } from '@/lib/utils';
import type { RendererProps } from './types';

export function TextareaInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = schema.ui_config?.label || schema.title || name;
  const placeholder = props.placeholder as string | undefined;
  const rows = (props.rows as number) || 4;
  const maxLength = schema.max_length;
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema if value is undefined/null
  const effectiveValue = getValueWithDefault<string>(value, schema, '');

  return (
    <div className="space-y-2">
      <Label htmlFor={path} className={cn(hasError && 'text-destructive')}>
        {label}
        {schema.required !== false && <span className="text-destructive ml-1">*</span>}
      </Label>
      <TextareaComponent
        id={path}
        value={(effectiveValue as string) || ''}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        disabled={isReadOnly}
        readOnly={isReadOnly}
        rows={rows}
        maxLength={maxLength}
        className={cn(hasError && 'border-destructive focus-visible:ring-destructive', isReadOnly && 'bg-muted cursor-not-allowed')}
      />
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

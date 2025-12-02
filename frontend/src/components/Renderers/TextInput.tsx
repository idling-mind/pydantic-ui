
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { RendererProps } from './types';

export function TextInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = schema.ui_config?.label || schema.title || name;
  const placeholder = props.placeholder as string | undefined;
  const maxLength = schema.max_length;
  const minLength = schema.min_length;

  return (
    <div className="space-y-2">
      <Label htmlFor={path} className={cn(hasError && 'text-destructive')}>
        {label}
        {schema.required !== false && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={path}
        type="text"
        value={(value as string) || ''}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        disabled={disabled}
        maxLength={maxLength}
        minLength={minLength}
        className={cn(hasError && 'border-destructive focus-visible:ring-destructive')}
      />
      {schema.description && (
        <p className="text-xs text-muted-foreground">{schema.description}</p>
      )}
      {hasError && (
        <p className="text-xs text-destructive">{errors[0].message}</p>
      )}
      {maxLength && (
        <p className="text-xs text-muted-foreground text-right">
          {((value as string) || '').length} / {maxLength}
        </p>
      )}
    </div>
  );
}

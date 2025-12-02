
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { RendererProps } from './types';

export function CheckboxInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const label = schema.ui_config?.label || schema.title || name;

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Checkbox
          id={path}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked === true)}
          disabled={disabled}
          className={cn(hasError && 'border-destructive')}
        />
        <Label
          htmlFor={path}
          className={cn(
            'text-sm font-normal cursor-pointer',
            hasError && 'text-destructive'
          )}
        >
          {label}
          {schema.required !== false && <span className="text-destructive ml-1">*</span>}
        </Label>
      </div>
      {schema.description && (
        <p className="text-xs text-muted-foreground ml-6">{schema.description}</p>
      )}
      {hasError && (
        <p className="text-xs text-destructive ml-6">{errors[0].message}</p>
      )}
    </div>
  );
}

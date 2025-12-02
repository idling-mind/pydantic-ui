
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { RendererProps } from './types';

export function ToggleInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const label = schema.ui_config?.label || schema.title || name;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label
            htmlFor={path}
            className={cn('cursor-pointer', hasError && 'text-destructive')}
          >
            {label}
            {schema.required !== false && <span className="text-destructive ml-1">*</span>}
          </Label>
          {schema.description && (
            <p className="text-xs text-muted-foreground">{schema.description}</p>
          )}
        </div>
        <Switch
          id={path}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked)}
          disabled={disabled}
          className={cn(hasError && 'data-[state=unchecked]:border-destructive')}
        />
      </div>
      {hasError && (
        <p className="text-xs text-destructive">{errors[0].message}</p>
      )}
    </div>
  );
}

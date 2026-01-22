
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import FieldHelp from '@/components/FieldHelp';
import { cn, getValueWithDefault } from '@/lib/utils';
import { ClearResetButtons } from './ClearResetButtons';
import type { RendererProps } from './types';

export function ToggleInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const label = schema.ui_config?.label || schema.title || name;
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema if value is undefined/null
  const effectiveValue = getValueWithDefault<boolean>(value, schema, false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label
            htmlFor={path}
            className={cn('cursor-pointer', hasError && 'text-destructive')}
          >
            <span className="inline-flex items-center gap-2">
              <span className="truncate">{label}</span>
              {schema.required !== false && <span className="text-destructive ml-1">*</span>}
              <FieldHelp helpText={schema.ui_config?.help_text} />
            </span>
          </Label>
          {schema.description && (
            <p className="text-xs text-muted-foreground">{schema.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Switch
            id={path}
            checked={Boolean(effectiveValue)}
            onCheckedChange={(checked) => onChange(checked)}
            disabled={isReadOnly}
            className={cn(hasError && 'data-[state=unchecked]:border-destructive', isReadOnly && 'cursor-not-allowed')}
          />
          <ClearResetButtons
            schema={schema}
            value={value}
            onChange={onChange}
            disabled={isReadOnly}
            variant="inline"
          />
        </div>
      </div>
      {hasError && (
        <p className="text-xs text-destructive">{errors[0].message}</p>
      )}
    </div>
  );
}

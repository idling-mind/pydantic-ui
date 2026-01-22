
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import FieldHelp from '@/components/FieldHelp';
import { cn, getValueWithDefault } from '@/lib/utils';
import type { RendererProps } from './types';

export function CheckboxInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const label = schema.ui_config?.label || schema.title || name;
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema if value is undefined/null
  const effectiveValue = getValueWithDefault<boolean>(value, schema, false);

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Checkbox
          id={path}
          checked={Boolean(effectiveValue)}
          onCheckedChange={(checked) => onChange(checked === true)}
          disabled={isReadOnly}
          className={cn(hasError && 'border-destructive', isReadOnly && 'cursor-not-allowed')}
        />
        <Label
          htmlFor={path}
          className={cn(
            'text-sm font-normal cursor-pointer',
            hasError && 'text-destructive'
          )}
        >
          <span className="inline-flex items-center gap-2">
            <span className="truncate">{label}</span>
            {schema.required !== false && <span className="text-destructive ml-1">*</span>}
            <FieldHelp helpText={schema.ui_config?.help_text} />
          </span>
        </Label>
      </div>
      {schema.description && (
        <p className="text-xs text-muted-foreground ml-6">{schema.description}</p>
      )}
      {/* help_text now shown via FieldHelp next to title */}
      {hasError && (
        <p className="text-xs text-destructive ml-6">{errors[0].message}</p>
      )}
    </div>
  );
}


import { Textarea as TextareaComponent } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import FieldHelp from '@/components/FieldHelp';
import { cn, getValueWithDefault } from '@/lib/utils';
import { getFieldLabel, getFieldHelpText, getFieldSubtitle } from '@/lib/displayUtils';
import { ClearResetButtons } from './ClearResetButtons';
import type { RendererProps } from './types';

export function TextareaInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = getFieldLabel(schema, name);
  const helpText = getFieldHelpText(schema);
  const subtitle = getFieldSubtitle(schema);
  const placeholder = schema.ui_config?.placeholder || (props.placeholder as string | undefined);
  const rows = (props.rows as number) || 4;
  const maxLength = schema.max_length;
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema only if value is undefined/null
  // Important: empty string "" is a valid value and should NOT fall back to default
  const effectiveValue = (value !== undefined && value !== null) 
    ? value 
    : getValueWithDefault<string>(value, schema, '');

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <Label htmlFor={path} className={cn(hasError && 'text-destructive')}>
          <span className="inline-flex items-center gap-2">
            <span className="truncate">{label}</span>
            {schema.required !== false && <span className="text-destructive ml-1">*</span>}
            <FieldHelp helpText={helpText} />
          </span>
        </Label>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <ClearResetButtons
        schema={schema}
        value={value}
        onChange={onChange}
        disabled={isReadOnly}
        variant="block"
      />
      <TextareaComponent
        id={path}
        value={(effectiveValue as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        disabled={isReadOnly}
        readOnly={isReadOnly}
        rows={rows}
        maxLength={maxLength}
        className={cn(hasError && 'border-destructive focus-visible:ring-destructive', isReadOnly && 'bg-muted cursor-not-allowed')}
      />
      {/* description now shown as subtitle above, help_text shown via FieldHelp */}
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

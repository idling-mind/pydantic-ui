
import { Slider as SliderComponent } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import FieldHelp from '@/components/FieldHelp';
import { cn, getValueWithDefault } from '@/lib/utils';
import { getFieldLabel, getFieldHelpText, getFieldSubtitle } from '@/lib/displayUtils';
import { ClearResetButtons } from './ClearResetButtons';
import type { RendererProps } from './types';

export function SliderInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = getFieldLabel(schema, name);
  const helpText = getFieldHelpText(schema);
  const subtitle = getFieldSubtitle(schema);
  
  const min = (props.min as number) ?? schema.minimum ?? 0;
  const max = (props.max as number) ?? schema.maximum ?? 100;
  const step = (props.step as number) ?? (schema.type === 'integer' ? 1 : 0.1);
  const showValue = props.showValue !== false;
  const isReadOnly = disabled || schema.ui_config?.read_only === true;
  
  // Use default value from schema if value is undefined/null, fallback to min
  const effectiveValue = getValueWithDefault<number>(value, schema, min);
  const currentValue = typeof effectiveValue === 'number' ? effectiveValue : min;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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
        {showValue && (
          <span className="text-sm font-mono text-muted-foreground">
            {currentValue}
          </span>
        )}
      </div>
      <ClearResetButtons
        schema={schema}
        value={value}
        onChange={onChange}
        disabled={isReadOnly}
        variant="block"
      />
      <SliderComponent
        id={path}
        value={[currentValue]}
        onValueChange={([val]) => onChange(val)}
        min={min}
        max={max}
        step={step}
        disabled={isReadOnly}
        className={cn(hasError && '[&_[role=slider]]:border-destructive', isReadOnly && 'opacity-50 cursor-not-allowed')}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {/* description now shown as subtitle above, help_text shown via FieldHelp */}
      {hasError && (
        <p className="text-xs text-destructive">{errors[0].message}</p>
      )}
    </div>
  );
}


import { Slider as SliderComponent } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { RendererProps } from './types';

export function SliderInput({ name, path, schema, value, errors, disabled, onChange }: RendererProps) {
  const hasError = errors && errors.length > 0;
  const props = schema.ui_config?.props || {};
  const label = schema.ui_config?.label || schema.title || name;
  
  const min = (props.min as number) ?? schema.minimum ?? 0;
  const max = (props.max as number) ?? schema.maximum ?? 100;
  const step = (props.step as number) ?? (schema.type === 'integer' ? 1 : 0.1);
  const showValue = props.showValue !== false;

  const currentValue = typeof value === 'number' ? value : min;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor={path} className={cn(hasError && 'text-destructive')}>
          {label}
          {schema.required !== false && <span className="text-destructive ml-1">*</span>}
        </Label>
        {showValue && (
          <span className="text-sm font-mono text-muted-foreground">
            {currentValue}
          </span>
        )}
      </div>
      <SliderComponent
        id={path}
        value={[currentValue]}
        onValueChange={([val]) => onChange(val)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={cn(hasError && '[&_[role=slider]]:border-destructive')}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
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
    </div>
  );
}

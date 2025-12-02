import React from 'react';
import { TextInput } from './TextInput';
import { TextareaInput } from './TextareaInput';
import { NumberInput } from './NumberInput';
import { SliderInput } from './SliderInput';
import { CheckboxInput } from './CheckboxInput';
import { ToggleInput } from './ToggleInput';
import { SelectInput } from './SelectInput';
import { DateInput } from './DateInput';
import { ColorInput } from './ColorInput';
import { JsonInput } from './JsonInput';
import type { RendererProps } from './types';
import type { SchemaField } from '@/types';

export type { RendererProps };

// Registry of renderers
const rendererMap: Record<string, React.ComponentType<RendererProps>> = {
  text: TextInput,
  textarea: TextareaInput,
  number: NumberInput,
  slider: SliderInput,
  checkbox: CheckboxInput,
  toggle: ToggleInput,
  select: SelectInput,
  date: DateInput,
  datetime: DateInput,
  color: ColorInput,
  json: JsonInput,
  // Aliases
  input: TextInput,
  switch: ToggleInput,
  range: SliderInput,
};

// Determine the best renderer based on schema
function getDefaultRenderer(schema: SchemaField): string {
  // Check for explicit renderer in ui_config
  if (schema.ui_config?.renderer) {
    return schema.ui_config.renderer;
  }

  // Check for enum/literal - use select
  if (schema.enum || schema.literal_values) {
    return 'select';
  }

  // Type-based defaults
  switch (schema.type) {
    case 'string':
      // Check for format hints
      if (schema.format === 'date') return 'date';
      if (schema.format === 'date-time') return 'datetime';
      if (schema.format === 'color') return 'color';
      if (schema.format === 'uri' || schema.format === 'url') return 'text';
      if (schema.format === 'email') return 'text';
      // Check for long text
      if (schema.max_length && schema.max_length > 200) return 'textarea';
      return 'text';

    case 'integer':
    case 'number':
      // Use slider if min/max are defined and range is reasonable
      if (
        schema.minimum !== undefined &&
        schema.maximum !== undefined &&
        schema.maximum - schema.minimum <= 1000
      ) {
        return 'slider';
      }
      return 'number';

    case 'boolean':
      return 'toggle';

    case 'object':
      // Generic object - use JSON editor
      if (!schema.fields) {
        return 'json';
      }
      return 'object'; // Will be handled separately

    case 'array':
      if (!schema.items) {
        return 'json';
      }
      return 'array'; // Will be handled separately

    default:
      return 'json';
  }
}

interface FieldRendererProps extends RendererProps {
  customRenderers?: Record<string, React.ComponentType<RendererProps>>;
}

export function FieldRenderer({
  name,
  path,
  schema,
  value,
  errors,
  disabled,
  onChange,
  customRenderers,
}: FieldRendererProps) {
  const rendererType = getDefaultRenderer(schema);
  
  // Check custom renderers first
  const Renderer = customRenderers?.[rendererType] || rendererMap[rendererType] || TextInput;

  return (
    <Renderer
      name={name}
      path={path}
      schema={schema}
      value={value}
      errors={errors}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

// Export individual renderers for direct use
export {
  TextInput,
  TextareaInput,
  NumberInput,
  SliderInput,
  CheckboxInput,
  ToggleInput,
  SelectInput,
  DateInput,
  ColorInput,
  JsonInput,
};

// Export utility
export { getDefaultRenderer };

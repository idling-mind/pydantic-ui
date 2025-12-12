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
import { FileSelectInput } from './FileSelectInput';
import { FileUploadInput } from './FileUploadInput';
import { UnionInput } from './UnionInput';
import { RadioGroupInput } from './RadioGroupInput';
import { ChecklistInput } from './ChecklistInput';
import { MarkdownInput } from './MarkdownInput';
import { SegmentedControlInput } from './SegmentedControlInput';
import { useData } from '@/context/DataContext';
import type { RendererProps } from './types';
import type { SchemaField, FieldError } from '@/types';

export type { RendererProps };

// Registry of renderers
const rendererMap: Record<string, React.ComponentType<RendererProps>> = {
  text: TextInput,
  text_input: TextInput,
  textarea: TextareaInput,
  text_area: TextareaInput,
  number: NumberInput,
  number_input: NumberInput,
  slider: SliderInput,
  checkbox: CheckboxInput,
  toggle: ToggleInput,
  select: SelectInput,
  date: DateInput,
  date_picker: DateInput,
  datetime: DateInput,
  datetime_picker: DateInput,
  color: ColorInput,
  color_picker: ColorInput,
  json: JsonInput,
  file_select: FileSelectInput,
  file_upload: FileUploadInput,
  radio_group: RadioGroupInput,
  checklist: ChecklistInput,
  markdown: MarkdownInput,
  segmented_control: SegmentedControlInput,
  multi_select: ChecklistInput,
  // Union renderers
  union: UnionInput,
  union_select: UnionInput,
  union_tabs: UnionInput,
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

  // Check for union type
  if (schema.type === 'union' && schema.variants) {
    // Use tabs for ≤4 variants, select for more
    return schema.variants.length <= 4 ? 'union_tabs' : 'union_select';
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
  errors: propErrors,
  disabled,
  onChange,
  customRenderers,
}: FieldRendererProps) {
  const { errors: contextErrors } = useData();
  
  // Get errors for this specific field path from context
  // This ensures we always have the most up-to-date errors regardless of prop drilling
  const fieldErrors = React.useMemo((): FieldError[] => {
    // First check prop errors (for backwards compatibility)
    if (propErrors && propErrors.length > 0) {
      // Filter for exact match or child paths
      const matchingPropErrors = propErrors.filter(
        e => e.path === path || e.path.startsWith(path + '.') || e.path.startsWith(path + '[')
      );
      if (matchingPropErrors.length > 0) {
        return matchingPropErrors;
      }
    }
    
    // Fall back to context errors
    if (!contextErrors || contextErrors.length === 0) return [];
    
    return contextErrors.filter(
      e => e.path === path || e.path.startsWith(path + '.') || e.path.startsWith(path + '[')
    );
  }, [propErrors, contextErrors, path]);
  
  const rendererType = getDefaultRenderer(schema);
  
  // Check custom renderers first
  const Renderer = customRenderers?.[rendererType] || rendererMap[rendererType] || TextInput;

  return (
    <Renderer
      name={name}
      path={path}
      schema={schema}
      value={value}
      errors={fieldErrors}
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
  FileSelectInput,
  FileUploadInput,
  UnionInput,
};

// Export utility
export { getDefaultRenderer };

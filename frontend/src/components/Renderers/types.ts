import type { SchemaField, FieldError } from '@/types';

export interface RendererProps {
  name: string;
  path: string;
  schema: SchemaField;
  value: unknown;
  errors?: FieldError[];
  disabled?: boolean;
  onChange: (value: unknown) => void;
}

export interface RendererComponentProps extends RendererProps {
  // Additional props can be added here
}

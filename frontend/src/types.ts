// Schema types
export interface SchemaField {
  type: string;
  title?: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  // Constraints - flattened for easier access
  minimum?: number;
  maximum?: number;
  exclusive_minimum?: number;
  exclusive_maximum?: number;
  min_length?: number;
  max_length?: number;
  min_items?: number;
  max_items?: number;
  pattern?: string;
  enum?: unknown[];
  literal_values?: unknown[];
  format?: string;
  // UI config
  ui_config?: {
    renderer?: string;
    label?: string;
    placeholder?: string;
    help_text?: string;
    hidden?: boolean;
    read_only?: boolean;
    group?: string;
    props?: Record<string, unknown>;
  };
  // Nested structures
  fields?: Record<string, SchemaField>;
  items?: SchemaField;
  additionalProperties?: SchemaField;
}

export interface Schema extends SchemaField {
  name?: string;
}

// Field error type
export interface FieldError {
  path: string;
  message: string;
  type?: string;
}

// UI Config types
export interface UIConfig {
  title: string;
  description: string;
  theme: 'light' | 'dark' | 'system';
  read_only: boolean;
  show_validation: boolean;
  auto_save: boolean;
  auto_save_delay: number;
  collapsible_tree: boolean;
  show_types: boolean;
}

// Data types
export interface DataResponse {
  data: Record<string, unknown>;
}

export interface UpdateResponse {
  data: Record<string, unknown>;
  valid: boolean;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  type: string;
}

export interface ValidationResponse {
  valid: boolean;
  errors: ValidationError[];
}

// Tree types
export interface TreeNodeData {
  name: string;
  path: string;
  schema: SchemaField;
  value?: unknown;
}

// Renderer types
export interface RendererProps {
  name: string;
  path: string;
  schema: SchemaField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
}

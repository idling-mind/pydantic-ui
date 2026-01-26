// Schema types

// View-specific display configuration
export interface ViewDisplay {
  title?: string | null;
  subtitle?: string | null;
  help_text?: string | null;
  icon?: string | null;
}

// Unified display configuration
export interface DisplayConfig {
  title?: string | null;
  subtitle?: string | null;
  help_text?: string | null;
  icon?: string | null;
  // Per-view overrides
  tree?: ViewDisplay | null;
  detail?: ViewDisplay | null;
  table?: ViewDisplay | null;
  card?: ViewDisplay | null;
}

// View types for display resolution
export type ViewType = 'tree' | 'detail' | 'table' | 'card';

// Discriminator configuration for discriminated unions
export interface DiscriminatorConfig {
  field: string | null;  // The field name used for discrimination, null for callable discriminators
  type: 'string' | 'callable';  // Type of discriminator
  mapping: Record<string, number> | null;  // Maps discriminator values to variant indices
}

// Union variant schema
export interface UnionVariant extends SchemaField {
  variant_index: number;
  variant_name: string;
  discriminator_values?: unknown[];  // The discriminator values that map to this variant
}

export interface SchemaField {
  type: string;
  python_type?: string;
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
    display?: DisplayConfig | null;
    placeholder?: string;
    hidden?: boolean;
    read_only?: boolean;
    visible_when?: string;
    options_from?: string;
    group?: string;
    props?: Record<string, unknown>;
  };
  // Nested structures
  fields?: Record<string, SchemaField>;
  items?: SchemaField;
  additionalProperties?: SchemaField;
  // Union-specific properties
  variants?: UnionVariant[];
  discriminator?: DiscriminatorConfig;
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

// Action button types
export interface ActionButton {
  id: string;
  label: string;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  icon?: string;
  disabled?: boolean;
  tooltip?: string;
  confirm?: string;
  upload_file?: boolean;
}

// UI Config types
export interface UIConfig {
  title: string;
  subtitle: string;
  logo_text: string | null;
  logo_url: string | null;
  theme: 'light' | 'dark' | 'system';
  read_only: boolean;
  show_validation: boolean;
  auto_save: boolean;
  auto_save_delay: number;
  collapsible_tree: boolean;
  show_types: boolean;
  actions: ActionButton[];
  show_save_reset: boolean;
  responsive_columns: Record<number, number>;
}

// SSE Event types
export interface UIEvent {
  type: 
    | 'validation_errors'
    | 'clear_validation_errors'
    | 'push_data'
    | 'toast'
    | 'confirmation_request'
    | 'refresh'
    | 'navigate'
    | 'download_file'
    | 'progress';
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
}

export interface ConfirmationRequest {
  id: string;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: 'default' | 'destructive';
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

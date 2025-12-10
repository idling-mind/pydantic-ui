// Schema types
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
    label?: string;
    placeholder?: string;
    help_text?: string;
    hidden?: boolean;
    read_only?: boolean;
    visible_when?: string;
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

// Action button types
export interface ActionButton {
  id: string;
  label: string;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  icon?: string;
  disabled?: boolean;
  tooltip?: string;
  confirm?: string;
}

// UI Config types
export interface UIConfig {
  title: string;
  description: string;
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
  footer_text: string;
  footer_url: string;
}

// SSE Event types
export interface UIEvent {
  type: 
    | 'validation_errors'
    | 'clear_validation_errors'
    | 'push_data'
    | 'toast'
    | 'confirmation_request'
    | 'refresh';
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

/**
 * Mock data fixtures for frontend tests
 */

import type { Schema, UIConfig, SchemaField } from '@/types';

// Simple string field
export const stringField: SchemaField = {
  type: 'string',
  python_type: 'str',
  title: 'Name',
  description: 'A string field',
  required: true,
  default: '',
};

// Integer field with constraints
export const integerField: SchemaField = {
  type: 'integer',
  python_type: 'int',
  title: 'Age',
  description: 'An integer field',
  required: false,
  default: 0,
  minimum: 0,
  maximum: 150,
};

// Boolean field
export const booleanField: SchemaField = {
  type: 'boolean',
  python_type: 'bool',
  title: 'Active',
  description: 'A boolean field',
  required: true,
  default: true,
};

// Enum/select field
export const enumField: SchemaField = {
  type: 'string',
  python_type: 'Priority',
  title: 'Priority',
  description: 'Priority level',
  required: true,
  enum: ['low', 'medium', 'high'],
};

// Literal field
export const literalField: SchemaField = {
  type: 'string',
  python_type: 'Literal["small", "medium", "large"]',
  title: 'Size',
  description: 'Size selection',
  required: true,
  literal_values: ['small', 'medium', 'large'],
};

// Array field
export const arrayField: SchemaField = {
  type: 'array',
  python_type: 'list[str]',
  title: 'Tags',
  description: 'List of tags',
  required: true,
  items: {
    type: 'string',
    title: 'Tag',
  },
};

// Object (nested model) field
export const objectField: SchemaField = {
  type: 'object',
  python_type: 'Address',
  title: 'Address',
  description: 'Nested address object',
  required: true,
  fields: {
    street: {
      type: 'string',
      title: 'Street',
      required: true,
    },
    city: {
      type: 'string',
      title: 'City',
      required: true,
    },
    zip: {
      type: 'string',
      title: 'Zip Code',
      required: false,
    },
  },
};

// Date field
export const dateField: SchemaField = {
  type: 'string',
  python_type: 'date',
  title: 'Birth Date',
  description: 'Date of birth',
  required: false,
  format: 'date',
};

// DateTime field
export const datetimeField: SchemaField = {
  type: 'string',
  python_type: 'datetime',
  title: 'Created At',
  description: 'Creation timestamp',
  required: true,
  format: 'date-time',
};

// Field with ui_config
export const fieldWithUiConfig: SchemaField = {
  type: 'integer',
  python_type: 'int',
  title: 'Slider Value',
  description: 'Value controlled by slider',
  required: true,
  default: 50,
  minimum: 0,
  maximum: 100,
  ui_config: {
    renderer: 'slider',
    help_text: 'Drag to select value',
    props: {
      step: 5,
    },
  },
};

// Complete test schema
export const testSchema: Schema = {
  name: 'TestModel',
  type: 'object',
  description: 'A comprehensive test model',
  fields: {
    name: stringField,
    age: integerField,
    active: booleanField,
    priority: enumField,
    tags: arrayField,
    address: objectField,
    birth_date: dateField,
    slider_value: fieldWithUiConfig,
  },
};

// Test UI config
export const testConfig: UIConfig = {
  title: 'Test Editor',
  description: 'Testing the pydantic-ui',
  logo_text: null,
  logo_url: null,
  logo_url_dark: null,
  favicon_url: null,
  theme: 'system',
  read_only: false,
  show_validation: true,
  auto_save: false,
  auto_save_delay: 1000,
  collapsible_tree: true,
  show_types: true,
  actions: [
    {
      id: 'validate',
      label: 'Validate',
      variant: 'secondary',
      icon: 'check',
    },
    {
      id: 'export',
      label: 'Export',
      variant: 'outline',
      icon: 'download',
    },
    {
      id: 'delete',
      label: 'Delete All',
      variant: 'destructive',
      icon: 'trash',
      confirm: 'Are you sure you want to delete everything?',
    },
  ],
  show_save_reset: true,
};

// Test data
export const testData = {
  name: 'John Doe',
  age: 30,
  active: true,
  priority: 'medium',
  tags: ['developer', 'tester'],
  address: {
    street: '123 Main St',
    city: 'Springfield',
    zip: '12345',
  },
  birth_date: '1990-05-15',
  slider_value: 75,
};

// Validation errors
export const validationErrors = [
  {
    path: 'name',
    message: 'Name cannot be empty',
    type: 'value_error',
  },
  {
    path: 'age',
    message: 'Age must be between 0 and 150',
    type: 'value_error',
  },
  {
    path: 'address.city',
    message: 'City is required',
    type: 'missing',
  },
];

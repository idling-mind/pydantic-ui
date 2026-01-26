import { describe, it, expect } from 'vitest';
import {
  resolveTemplate,
  resolveDisplay,
  resolveArrayItemDisplay,
  getFieldLabel,
  getFieldHelpText,
} from '@/lib/displayUtils';
import type { SchemaField, ViewType } from '@/types';

describe('resolveTemplate', () => {
  it('returns empty string if template has placeholders but no data', () => {
    expect(resolveTemplate('Hello {name}', undefined)).toBe('Hello ');
  });

  it('replaces single field placeholder', () => {
    expect(resolveTemplate('{name}', { name: 'John' })).toBe('John');
  });

  it('replaces multiple placeholders', () => {
    expect(resolveTemplate('{first} {last}', { first: 'John', last: 'Doe' })).toBe('John Doe');
  });

  it('handles nested path placeholders', () => {
    expect(resolveTemplate('{user.name}', { user: { name: 'Jane' } })).toBe('Jane');
  });

  it('handles deeply nested paths', () => {
    expect(resolveTemplate('{a.b.c}', { a: { b: { c: 'deep' } } })).toBe('deep');
  });

  it('preserves escaped braces', () => {
    expect(resolveTemplate('{{literal}}', { literal: 'value' })).toBe('{literal}');
  });

  it('returns empty string for unmatched placeholders', () => {
    expect(resolveTemplate('{missing}', { other: 'value' })).toBe('');
  });

  it('returns empty string for null values in data', () => {
    expect(resolveTemplate('{name}', { name: null })).toBe('');
  });

  it('returns empty string for undefined nested paths', () => {
    expect(resolveTemplate('{user.name}', { user: {} })).toBe('');
  });

  it('converts numbers to strings', () => {
    expect(resolveTemplate('{age}', { age: 25 })).toBe('25');
  });

  it('handles boolean values', () => {
    expect(resolveTemplate('{active}', { active: true })).toBe('true');
  });

  it('handles mixed content', () => {
    expect(resolveTemplate('User: {name} (ID: {id})', { name: 'Alice', id: 42 }))
      .toBe('User: Alice (ID: 42)');
  });
});

describe('resolveDisplay', () => {
  const baseSchema: SchemaField = {
    type: 'string',
  };

  it('returns formatted name when no display config', () => {
    const result = resolveDisplay({ schema: baseSchema, name: 'field_name' });
    // Names are converted to title case
    expect(result.title).toBe('Field Name');
  });

  it('uses schema.title if available', () => {
    const schema: SchemaField = { ...baseSchema, title: 'Field Title' };
    const result = resolveDisplay({ schema, name: 'field_name' });
    expect(result.title).toBe('Field Title');
  });

  it('uses display.title over schema.title', () => {
    const schema: SchemaField = {
      ...baseSchema,
      title: 'Schema Title',
      ui_config: {
        display: {
          title: 'Display Title',
        },
      },
    };
    const result = resolveDisplay({ schema, name: 'field_name' });
    expect(result.title).toBe('Display Title');
  });

  it('uses view-specific override when view provided', () => {
    const schema: SchemaField = {
      ...baseSchema,
      ui_config: {
        display: {
          title: 'Default Title',
          tree: { title: 'Tree Title' },
        },
      },
    };
    const treeResult = resolveDisplay({ schema, name: 'field', view: 'tree' });
    expect(treeResult.title).toBe('Tree Title');

    const detailResult = resolveDisplay({ schema, name: 'field', view: 'detail' });
    expect(detailResult.title).toBe('Default Title');
  });

  it('resolves help_text from display config', () => {
    const schema: SchemaField = {
      ...baseSchema,
      ui_config: {
        display: {
          help_text: 'This is help text',
        },
      },
    };
    const result = resolveDisplay({ schema, name: 'field' });
    expect(result.helpText).toBe('This is help text');
  });

  it('resolves subtitle from display config', () => {
    const schema: SchemaField = {
      ...baseSchema,
      ui_config: {
        display: {
          subtitle: 'Subtitle text',
        },
      },
    };
    const result = resolveDisplay({ schema, name: 'field' });
    expect(result.subtitle).toBe('Subtitle text');
  });

  it('uses formatted field name as fallback (not python_type)', () => {
    const schema: SchemaField = {
      ...baseSchema,
      python_type: 'MyCustomClass',
    };
    // python_type is not used for title - name is formatted instead
    const result = resolveDisplay({ schema, name: 'field' });
    expect(result.title).toBe('Field');
  });

  it('resolves template in title with data', () => {
    const schema: SchemaField = {
      ...baseSchema,
      ui_config: {
        display: {
          title: '{name} ({id})',
        },
      },
    };
    const result = resolveDisplay({
      schema,
      name: 'field',
      data: { name: 'Alice', id: 123 },
    });
    expect(result.title).toBe('Alice (123)');
  });
});

describe('resolveArrayItemDisplay', () => {
  const itemSchema: SchemaField = {
    type: 'object',
    fields: {
      name: { type: 'string' },
      email: { type: 'string' },
    },
  };

  it('returns index-based label when no display config', () => {
    const result = resolveArrayItemDisplay(
      itemSchema,
      { name: 'Alice', email: 'alice@test.com' },
      0
    );
    expect(result.title).toBe('Item 1');
  });

  it('uses template from display config', () => {
    const schema: SchemaField = {
      ...itemSchema,
      ui_config: {
        display: {
          title: '{name}',
        },
      },
    };
    const result = resolveArrayItemDisplay(
      schema,
      { name: 'Alice', email: 'alice@test.com' },
      0
    );
    expect(result.title).toBe('Alice');
  });

  it('uses view-specific template for tree view', () => {
    const schema: SchemaField = {
      ...itemSchema,
      ui_config: {
        display: {
          title: 'Default: {name}',
          tree: { title: 'Tree: {name}' },
        },
      },
    };
    const result = resolveArrayItemDisplay(
      schema,
      { name: 'Bob' },
      0,
      'tree'
    );
    expect(result.title).toBe('Tree: Bob');
  });

  it('falls back to index-based title when no display template', () => {
    const schema: SchemaField = {
      ...itemSchema,
      fields: {
        id: { type: 'integer' },
        name: { type: 'string' },
      },
    };
    const result = resolveArrayItemDisplay(
      schema,
      { id: 42, name: 'Charlie' },
      2
    );
    // Without a display template, falls back to "Item N"
    expect(result.title).toBe('Item 3');
  });

  it('resolves subtitle template when configured', () => {
    const schema: SchemaField = {
      ...itemSchema,
      ui_config: {
        display: {
          title: '{name}',
          subtitle: '{email}',
        },
      },
    };
    const result = resolveArrayItemDisplay(
      schema,
      { name: 'Alice', email: 'alice@test.com' },
      0
    );
    expect(result.subtitle).toBe('alice@test.com');
  });
});

describe('getFieldLabel', () => {
  it('uses display.title if available', () => {
    const schema: SchemaField = {
      type: 'string',
      ui_config: {
        display: {
          title: 'Custom Label',
        },
      },
    };
    expect(getFieldLabel(schema, 'field')).toBe('Custom Label');
  });

  it('uses schema.title as fallback', () => {
    const schema: SchemaField = {
      type: 'string',
      title: 'Schema Title',
    };
    expect(getFieldLabel(schema, 'field')).toBe('Schema Title');
  });

  it('uses formatted field name as last fallback', () => {
    const schema: SchemaField = {
      type: 'string',
    };
    // The implementation converts snake_case to Title Case
    expect(getFieldLabel(schema, 'my_field')).toBe('My Field');
  });
});

describe('getFieldHelpText', () => {
  it('returns display.help_text if available', () => {
    const schema: SchemaField = {
      type: 'string',
      ui_config: {
        display: {
          help_text: 'Help from display',
        },
      },
    };
    expect(getFieldHelpText(schema)).toBe('Help from display');
  });

  it('returns null when no help_text', () => {
    const schema: SchemaField = {
      type: 'string',
    };
    expect(getFieldHelpText(schema)).toBeNull();
  });
});

describe('view-specific resolution', () => {
  const views: ViewType[] = ['tree', 'detail', 'table', 'card'];

  it('respects view override for each view type', () => {
    const schema: SchemaField = {
      type: 'string',
      ui_config: {
        display: {
          title: 'Default',
          tree: { title: 'Tree View' },
          detail: { title: 'Detail View' },
          table: { title: 'Table View' },
          card: { title: 'Card View' },
        },
      },
    };

    expect(resolveDisplay({ schema, name: 'f', view: 'tree' }).title).toBe('Tree View');
    expect(resolveDisplay({ schema, name: 'f', view: 'detail' }).title).toBe('Detail View');
    expect(resolveDisplay({ schema, name: 'f', view: 'table' }).title).toBe('Table View');
    expect(resolveDisplay({ schema, name: 'f', view: 'card' }).title).toBe('Card View');
  });

  it('falls back to default when view override missing', () => {
    const schema: SchemaField = {
      type: 'string',
      ui_config: {
        display: {
          title: 'Default Title',
          tree: { title: 'Tree Only' },
        },
      },
    };

    expect(resolveDisplay({ schema, name: 'f', view: 'tree' }).title).toBe('Tree Only');
    expect(resolveDisplay({ schema, name: 'f', view: 'detail' }).title).toBe('Default Title');
    expect(resolveDisplay({ schema, name: 'f', view: 'table' }).title).toBe('Default Title');
    expect(resolveDisplay({ schema, name: 'f', view: 'card' }).title).toBe('Default Title');
  });

  it('partial view override merges with default display', () => {
    const schema: SchemaField = {
      type: 'string',
      ui_config: {
        display: {
          title: 'Default Title',
          help_text: 'Default Help',
          tree: { title: 'Tree Title' }, // Only overrides title, not help_text
        },
      },
    };

    const result = resolveDisplay({ schema, name: 'f', view: 'tree' });
    expect(result.title).toBe('Tree Title');
    expect(result.helpText).toBe('Default Help'); // Inherited from default
  });
});

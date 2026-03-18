import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import type { SchemaField } from '../../../src/types';
import { TableView } from '../../../src/components/TableView';

vi.mock('@revolist/react-datagrid', () => {
  const MockRevoGrid = React.forwardRef((_props, ref) => {
    React.useImperativeHandle(ref, () => ({
      refresh: () => undefined,
      setCellEdit: async () => undefined,
      querySelector: () => null,
      shadowRoot: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));

    return <div data-testid="mock-revogrid" />;
  });

  MockRevoGrid.displayName = 'MockRevoGrid';

  return {
    Editor: (component: unknown) => component,
    RevoGrid: MockRevoGrid,
  };
});

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('@/context/DataContext', () => ({
  useData: () => ({
    config: {
      table_pinned_columns: ['__check', '__row_number'],
      table_column_widths: null,
    },
    data: {},
    schema: {
      name: 'TestModel',
    },
  }),
}));

const tableSchema: SchemaField = {
  type: 'array',
  title: 'Users',
  items: {
    type: 'object',
    fields: {
      name: {
        type: 'string',
        title: 'Name',
      },
      age: {
        type: 'integer',
        title: 'Age',
      },
    },
  },
};

describe('TableView fullscreen mode', () => {
  it('toggles fullscreen mode and updates body overflow', async () => {
    const { container } = render(
      <TableView
        name="users"
        path="users"
        schema={tableSchema}
        value={[{ name: 'Alice', age: 31 }]}
        onChange={vi.fn()}
      />,
    );

    const tableView = container.querySelector('[data-pydantic-ui="table-view"]') as HTMLDivElement | null;
    const toggleButton = container.querySelector(
      '[data-pydantic-ui="table-toggle-fullscreen"]',
    ) as HTMLButtonElement | null;

    expect(tableView).not.toBeNull();
    expect(toggleButton).not.toBeNull();
    expect(tableView?.dataset.pydanticUiFullscreen).toBe('false');

    fireEvent.click(toggleButton as HTMLButtonElement);

    await waitFor(() => {
      expect(tableView?.dataset.pydanticUiFullscreen).toBe('true');
    });
    expect(tableView?.className).toContain('fixed');
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(toggleButton as HTMLButtonElement);

    await waitFor(() => {
      expect(tableView?.dataset.pydanticUiFullscreen).toBe('false');
    });
    expect(document.body.style.overflow).toBe('');
  });

  it('exits fullscreen mode when Escape is pressed', async () => {
    const { container } = render(
      <TableView
        name="users"
        path="users"
        schema={tableSchema}
        value={[{ name: 'Alice', age: 31 }]}
        onChange={vi.fn()}
      />,
    );

    const tableView = container.querySelector('[data-pydantic-ui="table-view"]') as HTMLDivElement | null;
    const toggleButton = container.querySelector(
      '[data-pydantic-ui="table-toggle-fullscreen"]',
    ) as HTMLButtonElement | null;

    fireEvent.click(toggleButton as HTMLButtonElement);

    await waitFor(() => {
      expect(tableView?.dataset.pydanticUiFullscreen).toBe('true');
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(tableView?.dataset.pydanticUiFullscreen).toBe('false');
    });
    expect(document.body.style.overflow).toBe('');
  });
});

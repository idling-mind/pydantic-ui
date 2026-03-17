import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentType } from 'react';
import type { EditorType } from '@revolist/react-datagrid';

vi.mock('@revolist/react-datagrid', () => ({
  Editor: (component: unknown) => component,
}));

import { selectEditor } from '../../../src/components/TableView/editors';

function createSelectProps(overrides: Partial<EditorType> = {}): EditorType {
  const save = vi.fn();
  const close = vi.fn();

  return {
    column: {
      prop: 'status',
      val: undefined,
      model: { status: 'open' },
      column: {
        __enumValues: ['open', 'closed'],
      },
    },
    save,
    close,
    ...overrides,
  } as unknown as EditorType;
}

function renderSelectEditor(props: EditorType): void {
  const SelectEditorComponent = selectEditor as unknown as ComponentType<EditorType>;
  render(<SelectEditorComponent {...props} />);
}

describe('table selectEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commits and closes when selecting a new option', () => {
    const props = createSelectProps();

    renderSelectEditor(props);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'closed' } });

    expect(props.save).toHaveBeenCalledWith('closed', true);
    expect(props.close).toHaveBeenCalledWith(false);
  });

  it('commits current value on blur even when option is unchanged', () => {
    const props = createSelectProps();

    renderSelectEditor(props);

    const select = screen.getByRole('combobox');
    fireEvent.blur(select);

    expect(props.save).toHaveBeenCalledWith('open', true);
    expect(props.close).toHaveBeenCalledWith(false);
  });

  it('does not commit after escape close', () => {
    const props = createSelectProps();

    renderSelectEditor(props);

    const select = screen.getByRole('combobox');
    fireEvent.keyDown(select, { key: 'Escape' });
    fireEvent.blur(select);

    expect(props.close).toHaveBeenCalled();
    expect(props.save).not.toHaveBeenCalled();
  });
});

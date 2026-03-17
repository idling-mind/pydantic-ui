import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentType } from 'react';
import type { EditorType } from '@revolist/react-datagrid';

vi.mock('@revolist/react-datagrid', () => ({
  Editor: (component: unknown) => component,
}));

import { selectEditor, textEditor } from '../../../src/components/TableView/editors';

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

function createTextProps(overrides: Partial<EditorType> = {}): EditorType {
  const save = vi.fn();
  const close = vi.fn();

  return {
    column: {
      prop: 'title',
      val: undefined,
      model: { title: 'hello' },
      column: {},
    },
    save,
    close,
    ...overrides,
  } as unknown as EditorType;
}

function renderTextEditor(props: EditorType): void {
  const TextEditorComponent = textEditor as unknown as ComponentType<EditorType>;
  render(<TextEditorComponent {...props} />);
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

describe('table textEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('places caret at end instead of selecting full content on mount', () => {
    const props = createTextProps();

    renderTextEditor(props);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.selectionStart).toBe(5);
    expect(input.selectionEnd).toBe(5);
  });

  it('commits once on Enter even when blur follows', () => {
    const props = createTextProps();

    renderTextEditor(props);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'hello world' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);

    expect(props.save).toHaveBeenCalledTimes(1);
    expect(props.save).toHaveBeenCalledWith('hello world', false);
  });

  it('commits on blur without advancing to next row', () => {
    const props = createTextProps();

    renderTextEditor(props);

    const input = screen.getByRole('textbox');
    fireEvent.blur(input);

    expect(props.save).toHaveBeenCalledTimes(1);
    expect(props.save).toHaveBeenCalledWith('hello', true);
  });
});

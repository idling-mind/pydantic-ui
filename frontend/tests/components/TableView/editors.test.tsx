import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentType } from 'react';
import type { EditorType } from '@revolist/react-datagrid';

vi.mock('@revolist/react-datagrid', () => ({
  Editor: (component: unknown) => component,
}));

import { selectEditor, sliderEditor, textEditor, numberEditor } from '../../../src/components/TableView/editors';

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

function createSliderProps(overrides: Partial<EditorType> = {}): EditorType {
  const save = vi.fn();
  const close = vi.fn();

  return {
    column: {
      prop: 'age',
      val: undefined,
      model: { age: 30 },
      column: {
        __minimum: 0,
        __maximum: 100,
        __step: 5,
        __isInteger: true,
      },
    },
    save,
    close,
    ...overrides,
  } as unknown as EditorType;
}

function renderSliderEditor(props: EditorType): void {
  const SliderEditorComponent = sliderEditor as unknown as ComponentType<EditorType>;
  render(<SliderEditorComponent {...props} />);
}

function createNumberProps(overrides: Partial<EditorType> = {}): EditorType {
  const save = vi.fn();
  const close = vi.fn();

  return {
    column: {
      prop: 'age',
      val: undefined,
      model: { age: 30 },
      column: {
        __minimum: 0,
        __maximum: 100,
        __step: 1,
        __isInteger: true,
      },
    },
    save,
    close,
    ...overrides,
  } as unknown as EditorType;
}

function renderNumberEditor(props: EditorType): void {
  const NumberEditorComponent = numberEditor as unknown as ComponentType<EditorType>;
  render(<NumberEditorComponent {...props} />);
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

describe('table numberEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commits parsed integer value on blur', () => {
    const props = createNumberProps();

    renderNumberEditor(props);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.blur(input);

    expect(props.save).toHaveBeenCalledTimes(1);
    expect(props.save).toHaveBeenCalledWith(42, true);
  });

  it('commits once on Enter even when blur follows', () => {
    const props = createNumberProps();

    renderNumberEditor(props);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '77' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);

    expect(props.save).toHaveBeenCalledTimes(1);
    expect(props.save).toHaveBeenCalledWith(77, false);
  });

  it('does not crash when number inputs do not support setSelectionRange', () => {
    const originalSetSelectionRange = HTMLInputElement.prototype.setSelectionRange;
    const setSelectionRangeSpy = vi
      .spyOn(HTMLInputElement.prototype, 'setSelectionRange')
      .mockImplementation(function (
        this: HTMLInputElement,
        start: number | null,
        end: number | null,
        direction?: 'forward' | 'backward' | 'none',
      ) {
        if (this.type === 'number') {
          throw new DOMException('The object is in an invalid state.');
        }
        return originalSetSelectionRange.call(this, start, end, direction);
      });

    const props = createNumberProps();

    expect(() => renderNumberEditor(props)).not.toThrow();

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '55' } });
    fireEvent.blur(input);

    expect(props.save).toHaveBeenCalledWith(55, true);
    setSelectionRangeSpy.mockRestore();
  });
});

describe('table sliderEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commits slider value on pointer release', () => {
    const props = createSliderProps();

    renderSliderEditor(props);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '45' } });
    fireEvent.mouseUp(slider);

    expect(props.save).toHaveBeenCalledTimes(1);
    expect(props.save).toHaveBeenCalledWith(45, true);
  });

  it('commits once on Enter even when blur follows', () => {
    const props = createSliderProps();

    renderSliderEditor(props);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '50' } });
    fireEvent.keyDown(slider, { key: 'Enter' });
    fireEvent.blur(slider);

    expect(props.save).toHaveBeenCalledTimes(1);
    expect(props.save).toHaveBeenCalledWith(50, false);
  });
});

/**
 * Tests for TextInput renderer
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextInput } from '@/components/Renderers/TextInput';
import type { RendererProps } from '@/components/Renderers/types';

const defaultProps: RendererProps = {
  name: 'testField',
  path: 'test.path',
  schema: {
    type: 'string',
    title: 'Test Field',
    description: 'A test field description',
    required: true,
  },
  value: 'initial value',
  onChange: vi.fn(),
};

describe('TextInput', () => {
  it('renders with initial value', () => {
    render(<TextInput {...defaultProps} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('initial value');
  });

  it('calls onChange when typing', async () => {
    const onChange = vi.fn();
    render(<TextInput {...defaultProps} onChange={onChange} />);
    
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'new value');
    
    expect(onChange).toHaveBeenCalled();
  });

  it('shows placeholder from schema', () => {
    const props = {
      ...defaultProps,
      schema: {
        ...defaultProps.schema,
        ui_config: {
          props: {
            placeholder: 'Enter value here',
          },
        },
      },
    };
    render(<TextInput {...props} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder', 'Enter value here');
  });

  it('displays error message', () => {
    render(<TextInput {...defaultProps} errors={[{ path: 'test.path', message: 'This field has an error' }]} />);
    expect(screen.getByText('This field has an error')).toBeInTheDocument();
  });

  it('applies disabled state', () => {
    render(<TextInput {...defaultProps} disabled />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('shows subtitle from description', () => {
    const props = {
      ...defaultProps,
      schema: {
        ...defaultProps.schema,
        description: 'This is the field subtitle',
      },
    };
    render(<TextInput {...props} />);
    // Description should appear as subtitle below the label
    expect(screen.getByText('This is the field subtitle')).toBeInTheDocument();
  });

  it('handles undefined value', () => {
    render(<TextInput {...defaultProps} value={undefined} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('');
  });

  it('handles null value', () => {
    render(<TextInput {...defaultProps} value={null} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('');
  });
});

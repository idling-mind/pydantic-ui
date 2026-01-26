/**
 * Tests for NumberInput renderer
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberInput } from '@/components/Renderers/NumberInput';
import type { RendererProps } from '@/components/Renderers/types';

const defaultProps: RendererProps = {
  name: 'count',
  path: 'test.count',
  schema: {
    type: 'integer',
    title: 'Count',
    description: 'A count field',
    required: true,
  },
  value: 42,
  onChange: vi.fn(),
};

describe('NumberInput', () => {
  it('renders with initial value', () => {
    render(<NumberInput {...defaultProps} />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(42);
  });

  it('calls onChange when typing', async () => {
    const onChange = vi.fn();
    render(<NumberInput {...defaultProps} onChange={onChange} />);
    
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '100');
    
    expect(onChange).toHaveBeenCalled();
  });

  it('displays error message', () => {
    render(<NumberInput {...defaultProps} errors={[{ path: 'test.count', message: 'Value must be positive' }]} />);
    expect(screen.getByText('Value must be positive')).toBeInTheDocument();
  });

  it('applies disabled state', () => {
    render(<NumberInput {...defaultProps} disabled />);
    const input = screen.getByRole('spinbutton');
    expect(input).toBeDisabled();
  });

  it('handles undefined value', () => {
    render(<NumberInput {...defaultProps} value={undefined} />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(null);
  });

  it('handles null value', () => {
    render(<NumberInput {...defaultProps} value={null} />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(null);
  });

  it('handles string value (converts to number)', () => {
    render(<NumberInput {...defaultProps} value="123" />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(123);
  });

  it('shows subtitle from description', () => {
    const props = {
      ...defaultProps,
      schema: {
        ...defaultProps.schema,
        description: 'Enter a valid number',
      },
    };
    render(<NumberInput {...props} />);
    // Description should appear as subtitle below the label
    expect(screen.getByText('Enter a valid number')).toBeInTheDocument();
  });
});

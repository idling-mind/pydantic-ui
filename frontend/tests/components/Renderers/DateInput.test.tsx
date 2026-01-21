/**
 * Tests for DateInput renderer
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateInput } from '@/components/Renderers/DateInput';
import type { RendererProps } from '@/components/Renderers/types';

const defaultProps: RendererProps = {
  name: 'testDate',
  path: 'test.date',
  schema: {
    type: 'string',
    title: 'Test Date',
    description: 'A test date field',
    required: true,
  },
  value: null,
  onChange: vi.fn(),
};

describe('DateInput', () => {
  it('renders pick a date button full width when time is not included', () => {
    render(<DateInput {...defaultProps} />);

    const button = screen.getByRole('button');
    // The wrapper should have w-full when includeTime is false
    const wrapper = button.closest('div.w-full');
    expect(wrapper).toBeInTheDocument();
  });

  it('renders a time input when includeTime is true', async () => {
    const props = {
      ...defaultProps,
      schema: {
        ...defaultProps.schema,
        ui_config: { props: { includeTime: true } },
      },
    };
    render(<DateInput {...props} />);

    const timeInput = await screen.findByRole('textbox', { name: /time/i }).catch(() => null);
    // Time input may not have an accessible name; fallback to input[type=time]
    if (!timeInput) {
      const input = document.querySelector('input[type="time"]');
      expect(input).toBeInTheDocument();
    } else {
      expect(timeInput).toBeInTheDocument();
    }
  });
});

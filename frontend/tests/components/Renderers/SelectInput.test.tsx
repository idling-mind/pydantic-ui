/**
 * Tests for SelectInput renderer with dynamic options
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectInput } from '@/components/Renderers/SelectInput';
import type { RendererProps } from '@/components/Renderers/types';

// Mock useData
vi.mock('@/context/DataContext', () => ({
  useData: () => ({
    data: {
      users: [
        { name: 'Alice' },
        { name: 'Bob' }
      ],
      nested: {
        items: [
          { id: '1', label: 'Item 1' },
          { id: '2', label: 'Item 2' }
        ]
      }
    }
  })
}));

// Mock Select component parts to avoid Radix UI complexity in unit tests
// or use a setup that handles Radix UI (which might be overkill here)
// For now, we'll rely on the fact that SelectInput renders options based on the hook.
// But wait, SelectInput uses resolveOptionsFromData which we just tested.
// So we mainly want to ensure SelectInput calls resolveOptionsFromData with correct args
// OR we can mock resolveOptionsFromData.

// Actually, let's just test that it renders correctly given the mocked data.
// Since Radix Select is complex to test without full DOM environment, 
// we can check if the options are generated in the memoized value.
// But we can't access internal state.

// Let's try to render and click the trigger to see options.
// Note: Radix UI Select renders options in a Portal, so we need to look for them in document.body.

const defaultProps: RendererProps = {
  name: 'testField',
  path: 'test.path',
  schema: {
    type: 'string',
    title: 'Test Field',
  },
  value: null,
  onChange: vi.fn(),
};

describe('SelectInput with dynamic options', () => {
  it('renders options from data source', async () => {
    const props = {
      ...defaultProps,
      schema: {
        ...defaultProps.schema,
        ui_config: {
          options_from: 'users.[].name'
        }
      }
    };

    render(<SelectInput {...props} />);
    
    // Find the trigger
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
    
    // Click to open
    fireEvent.click(trigger);
    
    // Options should be visible (Radix renders them in a portal)
    // We might need to wait for them or just query them
    const optionAlice = await screen.findByText('Alice');
    const optionBob = await screen.findByText('Bob');
    
    expect(optionAlice).toBeInTheDocument();
    expect(optionBob).toBeInTheDocument();
  });

  it('renders options from nested data source', async () => {
    const props = {
      ...defaultProps,
      schema: {
        ...defaultProps.schema,
        ui_config: {
          options_from: 'nested.items.[].label'
        }
      }
    };

    render(<SelectInput {...props} />);
    
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    
    const option1 = await screen.findByText('Item 1');
    const option2 = await screen.findByText('Item 2');
    
    expect(option1).toBeInTheDocument();
    expect(option2).toBeInTheDocument();
  });
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { NestedFieldCard } from '@/components/DetailPanel/NestedFieldCard';
import type { SchemaField } from '@/types';

const optionalObjectSchema: SchemaField = {
  type: 'object',
  required: false,
  python_type: 'Settings',
  fields: {
    mode: { type: 'string', required: false },
  },
};

const requiredObjectSchema: SchemaField = {
  ...optionalObjectSchema,
  required: true,
};

describe('NestedFieldCard', () => {
  it('asks for confirmation before disabling an optional field', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onNavigate = vi.fn();

    render(
      <NestedFieldCard
        name="settings"
        schema={optionalObjectSchema}
        value={{ mode: 'manual' }}
        path="settings"
        onNavigate={onNavigate}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Disable' }));

    expect(screen.getByText('Disable optional field?')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('clears the value only after disable confirmation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <NestedFieldCard
        name="settings"
        schema={optionalObjectSchema}
        value={{ mode: 'manual' }}
        path="settings"
        onNavigate={vi.fn()}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Disable' }));

    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Disable' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(null);
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('does not render disable action for required fields', () => {
    render(
      <NestedFieldCard
        name="settings"
        schema={requiredObjectSchema}
        value={{ mode: 'manual' }}
        path="settings"
        onNavigate={vi.fn()}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument();
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OrphanedErrors } from '../../src/components/DetailPanel/OrphanedErrors';
import type { FieldError, SchemaField } from '../../src/types';

const rootSchema: SchemaField = {
  type: 'object',
  fields: {
    user: {
      type: 'object',
      fields: {
        name: { type: 'string' },
      },
    },
  },
};

describe('OrphanedErrors', () => {
  it('navigates to the deepest resolvable field when clicking an orphaned path', () => {
    const onPathClick = vi.fn();
    const errors: FieldError[] = [
      {
        path: 'user.name.extra',
        message: 'Invalid nested path',
      },
    ];

    render(
      <OrphanedErrors
        errors={errors}
        basePath=""
        schema={rootSchema}
        onPathClick={onPathClick}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'user.name.extra' }));

    expect(onPathClick).toHaveBeenCalledTimes(1);
    expect(onPathClick).toHaveBeenCalledWith('user.name');
  });

  it('renders relative paths and keeps absolute navigation target for nested base paths', () => {
    const onPathClick = vi.fn();
    const nestedSchema: SchemaField = {
      type: 'object',
      fields: {
        address: {
          type: 'object',
          fields: {
            city: { type: 'string' },
          },
        },
      },
    };
    const errors: FieldError[] = [
      {
        path: 'profile.address.city.zip',
        message: 'Too deeply nested',
      },
    ];

    render(
      <OrphanedErrors
        errors={errors}
        basePath="profile"
        schema={nestedSchema}
        onPathClick={onPathClick}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'address.city.zip' }));

    expect(onPathClick).toHaveBeenCalledTimes(1);
    expect(onPathClick).toHaveBeenCalledWith('profile.address.city');
  });

  it('keeps model-level validation paths non-clickable', () => {
    const onPathClick = vi.fn();
    const errors: FieldError[] = [
      {
        path: '__root__',
        message: 'Model-level validation failed',
      },
    ];

    render(
      <OrphanedErrors
        errors={errors}
        basePath=""
        schema={rootSchema}
        onPathClick={onPathClick}
      />
    );

    expect(screen.getByText('(model validation)')).not.toBeNull();
    expect(screen.queryByRole('button', { name: '(model validation)' })).toBeNull();
    expect(onPathClick).not.toHaveBeenCalled();
  });

  it('shows completely unknown paths as plain text', () => {
    const onPathClick = vi.fn();
    const errors: FieldError[] = [
      {
        path: 'missing.branch',
        message: 'Unknown path',
      },
    ];

    render(
      <OrphanedErrors
        errors={errors}
        basePath=""
        schema={rootSchema}
        onPathClick={onPathClick}
      />
    );

    expect(screen.getByText('missing.branch')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'missing.branch' })).toBeNull();
    expect(onPathClick).not.toHaveBeenCalled();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OrphanedErrors } from '../../src/components/DetailPanel/OrphanedErrors';
import type { FieldError, SchemaField } from '../../src/types';

const userSchema: SchemaField = {
  type: 'object',
  fields: {
    name: { type: 'string' },
  },
};

const rootSchema: SchemaField = {
  type: 'object',
  fields: {
    user: userSchema,
  },
};

describe('OrphanedErrors', () => {
  it('does not bubble descendant orphaned errors to the root level', () => {
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
      />
    );

    expect(screen.queryByText('Invalid nested path')).toBeNull();
  });

  it('does not bubble descendant orphaned errors to intermediate ancestor levels', () => {
    const errors: FieldError[] = [
      {
        path: 'user.name.extra',
        message: 'Invalid nested path',
      },
    ];

    render(
      <OrphanedErrors
        errors={errors}
        basePath="user"
        schema={userSchema}
      />
    );

    expect(screen.queryByText('Invalid nested path')).toBeNull();
  });

  it('shows orphaned errors at the deepest reachable level', () => {
    const errors: FieldError[] = [
      {
        path: 'user.name.extra',
        message: 'Invalid nested path',
      },
    ];

    render(
      <OrphanedErrors
        errors={errors}
        basePath="user.name"
        schema={{ type: 'string' }}
      />
    );

    expect(screen.getByText('Invalid nested path')).not.toBeNull();
    expect(screen.getByText('extra')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'extra' })).toBeNull();
  });

  it('keeps model-level validation paths non-clickable', () => {
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
      />
    );

    expect(screen.getByText('(model validation)')).not.toBeNull();
    expect(screen.queryByRole('button', { name: '(model validation)' })).toBeNull();
  });

  it('shows completely unknown paths as plain text', () => {
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
      />
    );

    expect(screen.getByText('missing.branch')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'missing.branch' })).toBeNull();
  });
});

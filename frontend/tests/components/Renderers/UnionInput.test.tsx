import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { UnionInput } from '../../../src/components/Renderers/UnionInput';
import type { RendererProps } from '../../../src/components/Renderers/types';

vi.mock('@/context/DataContext', () => ({
  useData: () => ({
    setSelectedPath: vi.fn(),
    expandPath: vi.fn(),
    variantSelections: new Map<string, number>(),
    setVariantSelection: vi.fn(),
  }),
}));

const defaultProps: RendererProps = {
  name: 'storage_backend',
  path: 'storage_backend',
  schema: {
    type: 'union',
    ui_config: {
      display: {
        title: 'Storage Strategy',
      },
    },
    variants: [
      {
        type: 'object',
        variant_index: 0,
        variant_name: 'DiskStorage',
        discriminator_values: ['disk'],
        ui_config: {
          display: {
            card: {
              title: 'Disk Storage',
            },
          },
        },
        fields: {
          backend_type: { type: 'string' },
          root_path: { type: 'string' },
        },
      },
      {
        type: 'object',
        variant_index: 1,
        variant_name: 'S3Storage',
        discriminator_values: ['s3'],
        ui_config: {
          display: {
            card: {
              title: 'S3 Storage',
            },
          },
        },
        fields: {
          backend_type: { type: 'string' },
          bucket: { type: 'string' },
        },
      },
    ],
    discriminator: {
      field: 'backend_type',
      type: 'string',
      mapping: { disk: 0, s3: 1 },
    },
  },
  value: {
    backend_type: 'disk',
    root_path: '/var/lib/e2e',
  },
  onChange: vi.fn(),
};

describe('UnionInput', () => {
  it('uses display title overrides for field and variant card labels', () => {
    render(<UnionInput {...defaultProps} />);

    expect(screen.getByText('Storage Strategy')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Disk Storage' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'S3 Storage' })).not.toBeNull();
    expect(screen.queryByRole('heading', { name: /^disk$/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: /^s3$/i })).toBeNull();
  });
});

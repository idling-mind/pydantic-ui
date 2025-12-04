/**
 * Tests for lib/utils.ts
 */

import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn utility', () => {
  it('merges class names', () => {
    const result = cn('class1', 'class2');
    expect(result).toBe('class1 class2');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn(
      'base',
      isActive && 'active',
      isDisabled && 'disabled'
    );
    expect(result).toBe('base active');
    expect(result).not.toContain('disabled');
  });

  it('handles undefined and null values', () => {
    const result = cn('base', undefined, null, 'valid');
    expect(result).toBe('base valid');
  });

  it('handles empty strings', () => {
    const result = cn('base', '', 'valid');
    expect(result).toBe('base valid');
  });

  it('deduplicates tailwind classes', () => {
    // tailwind-merge should handle conflicting classes
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  it('handles arrays of classes', () => {
    const result = cn(['class1', 'class2']);
    expect(result).toContain('class1');
    expect(result).toContain('class2');
  });

  it('handles objects with boolean values', () => {
    const result = cn({
      base: true,
      active: true,
      disabled: false,
    });
    expect(result).toContain('base');
    expect(result).toContain('active');
    expect(result).not.toContain('disabled');
  });

  it('handles complex nesting', () => {
    const result = cn(
      'base',
      ['array-class'],
      { 'object-class': true },
      false && 'conditional',
      null,
      undefined
    );
    expect(result).toContain('base');
    expect(result).toContain('array-class');
    expect(result).toContain('object-class');
    expect(result).not.toContain('conditional');
  });
});

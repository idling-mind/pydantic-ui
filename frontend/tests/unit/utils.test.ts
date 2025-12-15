/**
 * Tests for lib/utils.ts
 */

import { describe, it, expect } from 'vitest';
import { cn, resolveOptionsFromData } from '@/lib/utils';

describe('resolveOptionsFromData', () => {
  const testData = {
    users: [
      { name: 'Alice', id: 1 },
      { name: 'Bob', id: 2 },
    ],
    department: {
      name: 'Engineering',
      staff: [
        { name: 'Charlie', role: 'Dev' },
        { name: 'Dave', role: 'QA' },
      ]
    },
    simpleList: ['Item 1', 'Item 2'],
    nested: {
      deep: {
        list: [
          { value: 'v1' },
          { value: 'v2' }
        ]
      }
    }
  };

  it('resolves simple array path', () => {
    const options = resolveOptionsFromData('simpleList', testData);
    expect(options).toEqual([
      { value: 'Item 1', label: 'Item 1' },
      { value: 'Item 2', label: 'Item 2' }
    ]);
  });

  it('resolves array of objects with wildcard', () => {
    const options = resolveOptionsFromData('users.[].name', testData);
    expect(options).toEqual([
      { value: 'Alice', label: 'Alice' },
      { value: 'Bob', label: 'Bob' }
    ]);
  });

  it('resolves nested array of objects', () => {
    const options = resolveOptionsFromData('department.staff.[].name', testData);
    expect(options).toEqual([
      { value: 'Charlie', label: 'Charlie' },
      { value: 'Dave', label: 'Dave' }
    ]);
  });

  it('resolves deeply nested array', () => {
    const options = resolveOptionsFromData('nested.deep.list.[].value', testData);
    expect(options).toEqual([
      { value: 'v1', label: 'v1' },
      { value: 'v2', label: 'v2' }
    ]);
  });

  it('returns empty array for invalid path', () => {
    expect(resolveOptionsFromData('invalid.path', testData)).toEqual([]);
    expect(resolveOptionsFromData('users.invalid', testData)).toEqual([]);
  });

  it('returns empty array for non-array target', () => {
    expect(resolveOptionsFromData('department.name', testData)).toEqual([]);
  });
});

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

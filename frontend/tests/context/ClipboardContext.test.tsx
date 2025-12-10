/**
 * Tests for ClipboardContext
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ClipboardProvider, useClipboard } from '@/context/ClipboardContext';
import type { SchemaField } from '@/types';

// Test component that uses the context
function TestConsumer({ onClipboard }: { onClipboard?: (ctx: ReturnType<typeof useClipboard>) => void }) {
  const ctx = useClipboard();
  if (onClipboard) {
    onClipboard(ctx);
  }
  return (
    <div>
      <div data-testid="has-clipboard">{ctx.clipboard ? 'yes' : 'no'}</div>
      <div data-testid="source-path">{ctx.clipboard?.sourcePath || 'none'}</div>
      <div data-testid="schema-name">{ctx.clipboard?.schemaName || 'none'}</div>
    </div>
  );
}

const stringSchema: SchemaField = {
  type: 'string',
  title: 'Name',
  required: true,
};

const integerSchema: SchemaField = {
  type: 'integer',
  title: 'Age',
  required: false,
};

const objectSchema: SchemaField = {
  type: 'object',
  title: 'Person',
  required: true,
  fields: {
    name: { type: 'string', title: 'Name', required: true },
    age: { type: 'integer', title: 'Age', required: false },
  },
};

const arraySchema: SchemaField = {
  type: 'array',
  title: 'People',
  required: true,
  items: objectSchema,
};

const differentObjectSchema: SchemaField = {
  type: 'object',
  title: 'Address',
  required: true,
  fields: {
    street: { type: 'string', title: 'Street', required: true },
    city: { type: 'string', title: 'City', required: true },
  },
};

describe('ClipboardProvider', () => {
  it('provides initial null clipboard state', () => {
    render(
      <ClipboardProvider>
        <TestConsumer />
      </ClipboardProvider>
    );

    expect(screen.getByTestId('has-clipboard').textContent).toBe('no');
    expect(screen.getByTestId('source-path').textContent).toBe('none');
  });
});

describe('useClipboard', () => {
  it('throws when used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useClipboard must be used within ClipboardProvider');

    consoleError.mockRestore();
  });
});

describe('copy', () => {
  it('copies data to clipboard', () => {
    let clipboardContext: ReturnType<typeof useClipboard> | null = null;

    render(
      <ClipboardProvider>
        <TestConsumer onClipboard={(ctx) => { clipboardContext = ctx; }} />
      </ClipboardProvider>
    );

    act(() => {
      clipboardContext!.copy('path.to.field', 'test value', stringSchema, 'string');
    });

    expect(screen.getByTestId('has-clipboard').textContent).toBe('yes');
    expect(screen.getByTestId('source-path').textContent).toBe('path.to.field');
    expect(screen.getByTestId('schema-name').textContent).toBe('string');
  });

  it('deep clones data to avoid reference issues', () => {
    let clipboardContext: ReturnType<typeof useClipboard> | null = null;

    render(
      <ClipboardProvider>
        <TestConsumer onClipboard={(ctx) => { clipboardContext = ctx; }} />
      </ClipboardProvider>
    );

    const originalData = { nested: { value: 'original' } };

    act(() => {
      clipboardContext!.copy('path', originalData, objectSchema, 'object');
    });

    // Modify original data
    originalData.nested.value = 'modified';

    // Clipboard should still have original value
    expect(clipboardContext!.clipboard?.data).toEqual({ nested: { value: 'original' } });
  });

  it('includes timestamp', () => {
    let clipboardContext: ReturnType<typeof useClipboard> | null = null;
    const before = Date.now();

    render(
      <ClipboardProvider>
        <TestConsumer onClipboard={(ctx) => { clipboardContext = ctx; }} />
      </ClipboardProvider>
    );

    act(() => {
      clipboardContext!.copy('path', 'value', stringSchema, 'string');
    });

    const after = Date.now();

    expect(clipboardContext!.clipboard?.timestamp).toBeGreaterThanOrEqual(before);
    expect(clipboardContext!.clipboard?.timestamp).toBeLessThanOrEqual(after);
  });
});

describe('clear', () => {
  it('clears the clipboard', () => {
    let clipboardContext: ReturnType<typeof useClipboard> | null = null;

    render(
      <ClipboardProvider>
        <TestConsumer onClipboard={(ctx) => { clipboardContext = ctx; }} />
      </ClipboardProvider>
    );

    act(() => {
      clipboardContext!.copy('path', 'value', stringSchema, 'string');
    });

    expect(screen.getByTestId('has-clipboard').textContent).toBe('yes');

    act(() => {
      clipboardContext!.clear();
    });

    expect(screen.getByTestId('has-clipboard').textContent).toBe('no');
  });
});

describe('canPaste', () => {
  it('returns false when clipboard is empty', () => {
    let clipboardContext: ReturnType<typeof useClipboard> | null = null;

    render(
      <ClipboardProvider>
        <TestConsumer onClipboard={(ctx) => { clipboardContext = ctx; }} />
      </ClipboardProvider>
    );

    expect(clipboardContext!.canPaste(stringSchema)).toBe(false);
  });

  it('returns true for matching primitive types', () => {
    let clipboardContext: ReturnType<typeof useClipboard> | null = null;

    render(
      <ClipboardProvider>
        <TestConsumer onClipboard={(ctx) => { clipboardContext = ctx; }} />
      </ClipboardProvider>
    );

    act(() => {
      clipboardContext!.copy('path', 'value', stringSchema, 'string');
    });

    expect(clipboardContext!.canPaste(stringSchema)).toBe(true);
  });

  it('returns false for mismatched primitive types', () => {
    let clipboardContext: ReturnType<typeof useClipboard> | null = null;

    render(
      <ClipboardProvider>
        <TestConsumer onClipboard={(ctx) => { clipboardContext = ctx; }} />
      </ClipboardProvider>
    );

    act(() => {
      clipboardContext!.copy('path', 'value', stringSchema, 'string');
    });

    expect(clipboardContext!.canPaste(integerSchema)).toBe(false);
  });

  it('returns true for compatible object schemas with field overlap', () => {
    let clipboardContext: ReturnType<typeof useClipboard> | null = null;

    render(
      <ClipboardProvider>
        <TestConsumer onClipboard={(ctx) => { clipboardContext = ctx; }} />
      </ClipboardProvider>
    );

    const sourceSchema: SchemaField = {
      type: 'object',
      title: 'Source',
      required: true,
      fields: {
        name: { type: 'string', title: 'Name', required: true },
        shared: { type: 'string', title: 'Shared', required: true },
      },
    };

    const targetSchema: SchemaField = {
      type: 'object',
      title: 'Target',
      required: true,
      fields: {
        shared: { type: 'string', title: 'Shared', required: true },
        other: { type: 'string', title: 'Other', required: true },
      },
    };

    act(() => {
      clipboardContext!.copy('path', {}, sourceSchema, 'object');
    });

    // Has overlapping 'shared' field
    expect(clipboardContext!.canPaste(targetSchema)).toBe(true);
  });

  it('returns false for object schemas without field overlap', () => {
    let clipboardContext: ReturnType<typeof useClipboard> | null = null;

    render(
      <ClipboardProvider>
        <TestConsumer onClipboard={(ctx) => { clipboardContext = ctx; }} />
      </ClipboardProvider>
    );

    act(() => {
      clipboardContext!.copy('path', {}, objectSchema, 'object');
    });

    // No overlapping fields
    expect(clipboardContext!.canPaste(differentObjectSchema)).toBe(false);
  });

  it('returns true for matching array types', () => {
    let clipboardContext: ReturnType<typeof useClipboard> | null = null;

    render(
      <ClipboardProvider>
        <TestConsumer onClipboard={(ctx) => { clipboardContext = ctx; }} />
      </ClipboardProvider>
    );

    const stringArraySchema: SchemaField = {
      type: 'array',
      title: 'Strings',
      required: true,
      items: { type: 'string', title: 'Item', required: true },
    };

    act(() => {
      clipboardContext!.copy('path', [], stringArraySchema, 'array');
    });

    expect(clipboardContext!.canPaste(stringArraySchema)).toBe(true);
  });
});

describe('canPasteToArray', () => {
  it('returns false when clipboard is empty', () => {
    let clipboardContext: ReturnType<typeof useClipboard> | null = null;

    render(
      <ClipboardProvider>
        <TestConsumer onClipboard={(ctx) => { clipboardContext = ctx; }} />
      </ClipboardProvider>
    );

    expect(clipboardContext!.canPasteToArray(arraySchema)).toBe(false);
  });

  it('returns false when target is not an array', () => {
    let clipboardContext: ReturnType<typeof useClipboard> | null = null;

    render(
      <ClipboardProvider>
        <TestConsumer onClipboard={(ctx) => { clipboardContext = ctx; }} />
      </ClipboardProvider>
    );

    act(() => {
      clipboardContext!.copy('path', {}, objectSchema, 'object');
    });

    expect(clipboardContext!.canPasteToArray(objectSchema)).toBe(false);
  });

  it('returns true when clipboard matches array item type', () => {
    let clipboardContext: ReturnType<typeof useClipboard> | null = null;

    render(
      <ClipboardProvider>
        <TestConsumer onClipboard={(ctx) => { clipboardContext = ctx; }} />
      </ClipboardProvider>
    );

    // Copy an object that matches the array's item schema
    act(() => {
      clipboardContext!.copy('path', { name: 'John', age: 30 }, objectSchema, 'Person');
    });

    // Should be able to paste into array of Person objects
    expect(clipboardContext!.canPasteToArray(arraySchema)).toBe(true);
  });

  it('returns false when clipboard does not match array item type', () => {
    let clipboardContext: ReturnType<typeof useClipboard> | null = null;

    render(
      <ClipboardProvider>
        <TestConsumer onClipboard={(ctx) => { clipboardContext = ctx; }} />
      </ClipboardProvider>
    );

    // Copy a string
    act(() => {
      clipboardContext!.copy('path', 'test', stringSchema, 'string');
    });

    // Should not be able to paste string into array of objects
    expect(clipboardContext!.canPasteToArray(arraySchema)).toBe(false);
  });
});

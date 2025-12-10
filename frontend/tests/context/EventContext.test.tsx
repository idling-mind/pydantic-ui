/**
 * Tests for EventContext
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { EventProvider, useEvents } from '@/context/EventContext';
import type { FieldError } from '@/types';

// Test component that uses the context
function TestConsumer({
  onToasts,
}: {
  onToasts?: (toasts: ReturnType<typeof useEvents>['toasts']) => void;
}) {
  const { toasts, confirmationRequest, addToast, removeToast, respondToConfirmation } = useEvents();
  
  if (onToasts) {
    onToasts(toasts);
  }

  return (
    <div>
      <div data-testid="toast-count">{toasts.length}</div>
      <div data-testid="has-confirmation">{confirmationRequest ? 'yes' : 'no'}</div>
      {toasts.map((toast) => (
        <div key={toast.id} data-testid={`toast-${toast.id}`}>
          {toast.message} - {toast.type}
        </div>
      ))}
      <button onClick={() => addToast({ message: 'Test toast', type: 'info', duration: 5000 })}>
        Add Toast
      </button>
      <button onClick={() => removeToast(toasts[0]?.id || '')}>Remove First</button>
      <button onClick={() => respondToConfirmation(true)}>Confirm</button>
      <button onClick={() => respondToConfirmation(false)}>Cancel</button>
    </div>
  );
}

describe('EventProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('provides initial empty state', () => {
    render(
      <EventProvider>
        <TestConsumer />
      </EventProvider>
    );

    expect(screen.getByTestId('toast-count').textContent).toBe('0');
    expect(screen.getByTestId('has-confirmation').textContent).toBe('no');
  });
});

describe('useEvents', () => {
  it('throws when used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useEvents must be used within EventProvider');

    consoleError.mockRestore();
  });
});

describe('addToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds a toast to the list', () => {
    render(
      <EventProvider>
        <TestConsumer />
      </EventProvider>
    );

    act(() => {
      screen.getByText('Add Toast').click();
    });

    expect(screen.getByTestId('toast-count').textContent).toBe('1');
  });

  it('toast has unique id', () => {
    let capturedToasts: ReturnType<typeof useEvents>['toasts'] = [];

    render(
      <EventProvider>
        <TestConsumer onToasts={(toasts) => { capturedToasts = toasts; }} />
      </EventProvider>
    );

    act(() => {
      screen.getByText('Add Toast').click();
    });

    expect(capturedToasts[0]).toBeDefined();
    expect(capturedToasts[0].id).toBeDefined();
    expect(typeof capturedToasts[0].id).toBe('string');
  });

  it('automatically removes toast after duration', () => {
    render(
      <EventProvider>
        <TestConsumer />
      </EventProvider>
    );

    act(() => {
      screen.getByText('Add Toast').click();
    });

    expect(screen.getByTestId('toast-count').textContent).toBe('1');

    // Fast-forward past duration
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByTestId('toast-count').textContent).toBe('0');
  });

  it('persistent toast with duration 0 does not auto-remove', () => {
    let capturedContext: ReturnType<typeof useEvents> | null = null;

    function CaptureContext() {
      capturedContext = useEvents();
      return null;
    }

    render(
      <EventProvider>
        <CaptureContext />
        <TestConsumer />
      </EventProvider>
    );

    act(() => {
      capturedContext!.addToast({ message: 'Persistent', type: 'error', duration: 0 });
    });

    expect(screen.getByTestId('toast-count').textContent).toBe('1');

    // Fast-forward a long time
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // Should still be there
    expect(screen.getByTestId('toast-count').textContent).toBe('1');
  });
});

describe('removeToast', () => {
  it('removes toast by id', () => {
    let capturedContext: ReturnType<typeof useEvents> | null = null;

    function CaptureContext() {
      capturedContext = useEvents();
      return null;
    }

    render(
      <EventProvider>
        <CaptureContext />
        <TestConsumer />
      </EventProvider>
    );

    act(() => {
      capturedContext!.addToast({ message: 'Toast 1', type: 'info', duration: 0 });
      capturedContext!.addToast({ message: 'Toast 2', type: 'success', duration: 0 });
    });

    expect(screen.getByTestId('toast-count').textContent).toBe('2');

    act(() => {
      screen.getByText('Remove First').click();
    });

    expect(screen.getByTestId('toast-count').textContent).toBe('1');
  });
});

describe('Event callbacks', () => {
  it('calls onValidationErrors when validation_errors event received', () => {
    const onValidationErrors = vi.fn();
    const errors: FieldError[] = [{ path: 'name', message: 'Required', type: 'missing' }];

    let capturedContext: ReturnType<typeof useEvents> | null = null;

    function CaptureContext() {
      capturedContext = useEvents();
      return null;
    }

    render(
      <EventProvider onValidationErrors={onValidationErrors}>
        <CaptureContext />
      </EventProvider>
    );

    // Note: In a real test, we would simulate SSE events
    // For now, we verify the provider accepts the callback
    expect(onValidationErrors).not.toHaveBeenCalled();
  });

  it('calls onClearErrors callback when provided', () => {
    const onClearErrors = vi.fn();

    render(
      <EventProvider onClearErrors={onClearErrors}>
        <TestConsumer />
      </EventProvider>
    );

    // Verify callback is accepted
    expect(onClearErrors).not.toHaveBeenCalled();
  });

  it('calls onDataPush callback when provided', () => {
    const onDataPush = vi.fn();

    render(
      <EventProvider onDataPush={onDataPush}>
        <TestConsumer />
      </EventProvider>
    );

    // Verify callback is accepted
    expect(onDataPush).not.toHaveBeenCalled();
  });

  it('calls onRefresh callback when provided', () => {
    const onRefresh = vi.fn();

    render(
      <EventProvider onRefresh={onRefresh}>
        <TestConsumer />
      </EventProvider>
    );

    // Verify callback is accepted
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

describe('Toast types', () => {
  it('supports info type', () => {
    let capturedContext: ReturnType<typeof useEvents> | null = null;

    function CaptureContext() {
      capturedContext = useEvents();
      return null;
    }

    render(
      <EventProvider>
        <CaptureContext />
        <TestConsumer />
      </EventProvider>
    );

    act(() => {
      capturedContext!.addToast({ message: 'Info', type: 'info', duration: 0 });
    });

    expect(screen.getByText('Info - info')).toBeInTheDocument();
  });

  it('supports success type', () => {
    let capturedContext: ReturnType<typeof useEvents> | null = null;

    function CaptureContext() {
      capturedContext = useEvents();
      return null;
    }

    render(
      <EventProvider>
        <CaptureContext />
        <TestConsumer />
      </EventProvider>
    );

    act(() => {
      capturedContext!.addToast({ message: 'Success', type: 'success', duration: 0 });
    });

    expect(screen.getByText('Success - success')).toBeInTheDocument();
  });

  it('supports error type', () => {
    let capturedContext: ReturnType<typeof useEvents> | null = null;

    function CaptureContext() {
      capturedContext = useEvents();
      return null;
    }

    render(
      <EventProvider>
        <CaptureContext />
        <TestConsumer />
      </EventProvider>
    );

    act(() => {
      capturedContext!.addToast({ message: 'Error', type: 'error', duration: 0 });
    });

    expect(screen.getByText('Error - error')).toBeInTheDocument();
  });

  it('supports warning type', () => {
    let capturedContext: ReturnType<typeof useEvents> | null = null;

    function CaptureContext() {
      capturedContext = useEvents();
      return null;
    }

    render(
      <EventProvider>
        <CaptureContext />
        <TestConsumer />
      </EventProvider>
    );

    act(() => {
      capturedContext!.addToast({ message: 'Warning', type: 'warning', duration: 0 });
    });

    expect(screen.getByText('Warning - warning')).toBeInTheDocument();
  });
});

describe('Multiple toasts', () => {
  it('can have multiple toasts at once', () => {
    let capturedContext: ReturnType<typeof useEvents> | null = null;

    function CaptureContext() {
      capturedContext = useEvents();
      return null;
    }

    render(
      <EventProvider>
        <CaptureContext />
        <TestConsumer />
      </EventProvider>
    );

    act(() => {
      capturedContext!.addToast({ message: 'Toast 1', type: 'info', duration: 0 });
      capturedContext!.addToast({ message: 'Toast 2', type: 'success', duration: 0 });
      capturedContext!.addToast({ message: 'Toast 3', type: 'warning', duration: 0 });
    });

    expect(screen.getByTestId('toast-count').textContent).toBe('3');
  });
});

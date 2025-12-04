/**
 * Tests for DataContext
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { DataProvider, useData } from '@/context/DataContext';
import { ReactNode } from 'react';

// Test component that uses the context
function TestConsumer() {
  const {
    schema,
    config,
    data,
    errors,
    loading,
    dirty,
    selectedPath,
    updateValue,
    saveData,
    resetData,
    getErrorCountForPath,
  } = useData();

  return (
    <div>
      <div data-testid="loading">{loading ? 'true' : 'false'}</div>
      <div data-testid="dirty">{dirty ? 'true' : 'false'}</div>
      <div data-testid="schema">{schema ? schema.name : 'null'}</div>
      <div data-testid="config">{config ? config.title : 'null'}</div>
      <div data-testid="data">{JSON.stringify(data)}</div>
      <div data-testid="errors">{JSON.stringify(errors)}</div>
      <div data-testid="selectedPath">{selectedPath || 'null'}</div>
      <div data-testid="errorCount">{getErrorCountForPath('')}</div>
      <button onClick={() => updateValue('name', 'Updated')}>Update Name</button>
      <button onClick={() => saveData()}>Save</button>
      <button onClick={() => resetData()}>Reset</button>
    </div>
  );
}

function renderWithProvider(ui: ReactNode) {
  return render(<DataProvider apiBase="/api">{ui}</DataProvider>);
}

describe('DataProvider', () => {
  it('provides initial loading state', async () => {
    renderWithProvider(<TestConsumer />);
    
    // Initially loading
    expect(screen.getByTestId('loading').textContent).toBe('true');
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });

  it('loads schema on mount', async () => {
    renderWithProvider(<TestConsumer />);
    
    await waitFor(() => {
      expect(screen.getByTestId('schema').textContent).toBe('TestModel');
    });
  });

  it('loads config on mount', async () => {
    renderWithProvider(<TestConsumer />);
    
    await waitFor(() => {
      expect(screen.getByTestId('config').textContent).toBe('Test Editor');
    });
  });

  it('loads data on mount', async () => {
    renderWithProvider(<TestConsumer />);
    
    await waitFor(() => {
      const data = JSON.parse(screen.getByTestId('data').textContent || '{}');
      expect(data.name).toBe('John Doe');
    });
  });
});

describe('useData', () => {
  it('throws when used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useData must be used within DataProvider');
    
    consoleError.mockRestore();
  });
});

describe('updateValue', () => {
  it('updates value and marks as dirty', async () => {
    renderWithProvider(<TestConsumer />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    
    // Initial state - not dirty
    expect(screen.getByTestId('dirty').textContent).toBe('false');
    
    // Update value
    await act(async () => {
      screen.getByText('Update Name').click();
    });
    
    // Should be dirty now
    await waitFor(() => {
      expect(screen.getByTestId('dirty').textContent).toBe('true');
    });
    
    // Data should be updated
    const data = JSON.parse(screen.getByTestId('data').textContent || '{}');
    expect(data.name).toBe('Updated');
  });
});

describe('saveData', () => {
  it('clears dirty flag on success', async () => {
    renderWithProvider(<TestConsumer />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    
    // Update value to make dirty
    await act(async () => {
      screen.getByText('Update Name').click();
    });
    
    // Save
    await act(async () => {
      screen.getByText('Save').click();
    });
    
    // Should no longer be dirty
    await waitFor(() => {
      expect(screen.getByTestId('dirty').textContent).toBe('false');
    });
  });
});

describe('resetData', () => {
  it('restores original data', async () => {
    renderWithProvider(<TestConsumer />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    
    const originalData = screen.getByTestId('data').textContent;
    
    // Update value
    await act(async () => {
      screen.getByText('Update Name').click();
    });
    
    // Data changed
    expect(screen.getByTestId('data').textContent).not.toBe(originalData);
    
    // Reset
    await act(async () => {
      screen.getByText('Reset').click();
    });
    
    // Should be back to original
    await waitFor(() => {
      expect(screen.getByTestId('data').textContent).toBe(originalData);
    });
  });

  it('clears dirty flag', async () => {
    renderWithProvider(<TestConsumer />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    
    // Update to make dirty
    await act(async () => {
      screen.getByText('Update Name').click();
    });
    
    expect(screen.getByTestId('dirty').textContent).toBe('true');
    
    // Reset
    await act(async () => {
      screen.getByText('Reset').click();
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('dirty').textContent).toBe('false');
    });
  });
});

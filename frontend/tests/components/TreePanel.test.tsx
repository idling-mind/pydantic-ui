import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DataProvider } from '@/context/DataContext';
import { ClipboardProvider } from '@/context/ClipboardContext';
import { TreePanel } from '@/components/TreePanel';

describe('TreePanel keyboard shortcuts', () => {
  it('focuses the search input when Ctrl+K (or Cmd+K) is pressed', async () => {
    render(
      <DataProvider apiBase="/api">
        <ClipboardProvider>
          <TreePanel />
        </ClipboardProvider>
      </DataProvider>
    );

    // Wait for the search input to be rendered (DataProvider loads schema)
    const input = await waitFor(() =>
      screen.getByPlaceholderText('Search fields... (Ctrl+K)') as HTMLInputElement
    );

    // Ensure it's present and not focused initially
    expect(input).toBeInTheDocument();
    expect(document.activeElement).not.toBe(input);

    // Simulate Ctrl+K
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });

    // Blur then try with Meta (Cmd on mac)
    input.blur();
    expect(document.activeElement).not.toBe(input);

    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });
});

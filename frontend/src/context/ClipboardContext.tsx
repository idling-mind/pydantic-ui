import React, { createContext, useContext, useState, useCallback } from 'react';
import type { SchemaField } from '@/types';

// Represents a copied node's data and metadata
export interface ClipboardData {
  // The path where the data was copied from
  sourcePath: string;
  // The actual data that was copied
  data: unknown;
  // The schema of the copied data (for type matching)
  schema: SchemaField;
  // Schema name/type for display
  schemaName: string;
  // Timestamp when copied
  timestamp: number;
}

interface ClipboardContextValue {
  clipboard: ClipboardData | null;
  copy: (path: string, data: unknown, schema: SchemaField, schemaName: string) => void;
  clear: () => void;
  canPaste: (targetSchema: SchemaField) => boolean;
}

const ClipboardContext = createContext<ClipboardContextValue | null>(null);

interface ClipboardProviderProps {
  children: React.ReactNode;
}

// Check if two schemas are compatible for paste
function schemasAreCompatible(source: SchemaField, target: SchemaField): boolean {
  // Basic type must match
  if (source.type !== target.type) {
    return false;
  }

  // For objects, check if they have similar structure
  // We'll be lenient here - as long as base type matches, allow paste
  if (source.type === 'object') {
    // If both have fields defined, they should have at least some overlap
    if (source.fields && target.fields) {
      const sourceFields = Object.keys(source.fields);
      const targetFields = Object.keys(target.fields);
      // Check if there's at least some field overlap
      const hasOverlap = sourceFields.some(f => targetFields.includes(f));
      return hasOverlap || sourceFields.length === 0 || targetFields.length === 0;
    }
    return true;
  }

  // For arrays, check item compatibility
  if (source.type === 'array') {
    if (source.items && target.items) {
      return schemasAreCompatible(source.items, target.items);
    }
    return true;
  }

  // For primitive types, just type match is enough
  return true;
}

export function ClipboardProvider({ children }: ClipboardProviderProps) {
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);

  const copy = useCallback((path: string, data: unknown, schema: SchemaField, schemaName: string) => {
    setClipboard({
      sourcePath: path,
      data: JSON.parse(JSON.stringify(data)), // Deep clone to avoid reference issues
      schema,
      schemaName,
      timestamp: Date.now(),
    });
  }, []);

  const clear = useCallback(() => {
    setClipboard(null);
  }, []);

  const canPaste = useCallback((targetSchema: SchemaField): boolean => {
    if (!clipboard) return false;
    return schemasAreCompatible(clipboard.schema, targetSchema);
  }, [clipboard]);

  return (
    <ClipboardContext.Provider value={{ clipboard, copy, clear, canPaste }}>
      {children}
    </ClipboardContext.Provider>
  );
}

export function useClipboard() {
  const context = useContext(ClipboardContext);
  if (!context) {
    throw new Error('useClipboard must be used within ClipboardProvider');
  }
  return context;
}

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { Schema, UIConfig, FieldError } from '@/types';
import { createApiClient } from '@/api';

interface DataContextValue {
  schema: Schema | null;
  config: UIConfig | null;
  data: Record<string, unknown>;
  errors: FieldError[];
  loading: boolean;
  dirty: boolean;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  setSelectedPath: (path: string | null) => void;
  toggleExpanded: (path: string) => void;
  expandPath: (path: string) => void;
  updateValue: (path: string, value: unknown) => void;
  saveData: () => Promise<boolean>;
  resetData: () => void;
  refresh: () => Promise<void>;
  getErrorCountForPath: (path: string) => number;
  errorCountByPath: Map<string, number>;
  // New methods for external updates (from SSE events)
  setExternalErrors: (errors: FieldError[]) => void;
  clearErrors: () => void;
  setExternalData: (data: Record<string, unknown>) => void;
  apiBase: string;
}

const DataContext = createContext<DataContextValue | null>(null);

interface DataProviderProps {
  children: React.ReactNode;
  apiBase?: string;
}

// LocalStorage helpers for data persistence
const STORAGE_KEY_PREFIX = 'pydantic-ui-data-';

function getStorageKey(schemaName: string | undefined): string {
  return `${STORAGE_KEY_PREFIX}${schemaName || 'default'}`;
}

function loadFromLocalStorage(schemaName: string | undefined): Record<string, unknown> | null {
  try {
    const key = getStorageKey(schemaName);
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load data from localStorage:', error);
  }
  return null;
}

function saveToLocalStorage(schemaName: string | undefined, data: Record<string, unknown>): void {
  try {
    const key = getStorageKey(schemaName);
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save data to localStorage:', error);
  }
}

function clearLocalStorage(schemaName: string | undefined): void {
  try {
    const key = getStorageKey(schemaName);
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to clear localStorage:', error);
  }
}

export function DataProvider({ children, apiBase = '/api' }: DataProviderProps) {
  const api = useMemo(() => createApiClient(apiBase), [apiBase]);
  
  const [schema, setSchema] = useState<Schema | null>(null);
  const [config, setConfig] = useState<UIConfig | null>(null);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [originalData, setOriginalData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([''])); // Root path is empty string

  // Helper to normalize a path from backend format (users.0.name) to frontend format (users[0].name)
  const normalizePathToFrontend = useCallback((path: string): string => {
    // Replace patterns like ".0." or ".0" at end with "[0]." or "[0]"
    // e.g., "users.0.compensation.amount" -> "users[0].compensation.amount"
    return path.replace(/\.(\d+)(?=\.|$)/g, '[$1]');
  }, []);

  // Helper to normalize errors (convert paths to frontend format)
  const normalizeErrors = useCallback((rawErrors: FieldError[]): FieldError[] => {
    return rawErrors.map(error => ({
      ...error,
      path: normalizePathToFrontend(error.path),
    }));
  }, [normalizePathToFrontend]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [schemaRes, configRes, dataRes] = await Promise.all([
        api.getSchema(),
        api.getConfig(),
        api.getData(),
      ]);
      setSchema(schemaRes);
      setConfig(configRes);
      
      // Check localStorage for saved data
      const savedData = loadFromLocalStorage(schemaRes.name);
      if (savedData && Object.keys(savedData).length > 0) {
        // Use saved data from localStorage (user's unsaved changes)
        setData(savedData);
        setDirty(true); // Mark as dirty since it differs from server
      } else {
        // Use server data
        setData(dataRes.data);
        setDirty(false);
      }
      
      setOriginalData(dataRes.data);
      setErrors([]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-save to localStorage when data changes
  useEffect(() => {
    if (schema && dirty) {
      saveToLocalStorage(schema.name, data);
    }
  }, [data, dirty, schema]);

  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const expandPath = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      // Expand all parent paths
      const parts = path.split('.');
      let currentPath = '';
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}.${part}` : part;
        next.add(currentPath);
      }
      return next;
    });
  }, []);

  const updateValue = useCallback((path: string, value: unknown) => {
    // Update locally only - no API call until Save
    setData((prevData) => {
      const newData = JSON.parse(JSON.stringify(prevData)); // Deep clone
      
      // Parse path with array index support: e.g., "users[0].name" or "items[2]"
      const pathRegex = /([^.\[\]]+)|\[(\d+)\]/g;
      const parts: { key: string; isIndex: boolean }[] = [];
      let match;
      while ((match = pathRegex.exec(path)) !== null) {
        if (match[1] !== undefined) {
          parts.push({ key: match[1], isIndex: false });
        } else if (match[2] !== undefined) {
          parts.push({ key: match[2], isIndex: true });
        }
      }
      
      let current: Record<string, unknown> | unknown[] = newData;
      
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const nextPart = parts[i + 1];
        
        if (part.isIndex) {
          const index = parseInt(part.key, 10);
          if (!Array.isArray(current)) break;
          if (current[index] === undefined || current[index] === null) {
            // Create the next structure based on what comes next
            current[index] = nextPart?.isIndex ? [] : {};
          }
          current = current[index] as Record<string, unknown> | unknown[];
        } else {
          if (Array.isArray(current)) break;
          if (current[part.key] === undefined || current[part.key] === null) {
            // Create the next structure based on what comes next
            current[part.key] = nextPart?.isIndex ? [] : {};
          }
          current = current[part.key] as Record<string, unknown> | unknown[];
        }
      }
      
      // Set the final value
      const lastPart = parts[parts.length - 1];
      if (lastPart) {
        if (lastPart.isIndex) {
          const index = parseInt(lastPart.key, 10);
          if (Array.isArray(current)) {
            current[index] = value;
          }
        } else {
          if (!Array.isArray(current)) {
            current[lastPart.key] = value;
          }
        }
      }
      
      return newData;
    });
    // Mark as dirty - keep errors visible until save
    setDirty(true);
  }, []);

  const saveData = useCallback(async (): Promise<boolean> => {
    try {
      const result = await api.updateData(data);
      if (result.valid) {
        setData(result.data);
        setOriginalData(result.data);
        setErrors([]);
        setDirty(false);
        // Clear localStorage on successful save (data is now synced with server)
        clearLocalStorage(schema?.name);
        return true;
      } else {
        // Normalize error paths to frontend format
        setErrors(normalizeErrors(result.errors || []));
        return false;
      }
    } catch (error) {
      console.error('Failed to save data:', error);
      return false;
    }
  }, [api, data, normalizeErrors, schema?.name]);

  const resetData = useCallback(() => {
    setData(originalData);
    setErrors([]);
    setDirty(false);
    // Clear localStorage on reset (reverting to server data)
    clearLocalStorage(schema?.name);
  }, [originalData, schema?.name]);

  // New methods for external updates (from SSE events)
  const setExternalErrors = useCallback((newErrors: FieldError[]) => {
    setErrors(normalizeErrors(newErrors));
  }, [normalizeErrors]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const setExternalData = useCallback((newData: Record<string, unknown>) => {
    setData(newData);
    setOriginalData(newData);
    setErrors([]);
    setDirty(false);
    // Clear localStorage when new data is pushed from server (this is now the source of truth)
    clearLocalStorage(schema?.name);
  }, [schema?.name]);

  // Compute error counts per path (including parent paths)
  // Note: errors are already normalized to frontend format (users[0].name)
  const errorCountByPath = useMemo(() => {
    const counts = new Map<string, number>();
    
    // Helper to build all parent paths from a normalized path
    const buildParentPaths = (normalizedPath: string): string[] => {
      const parts: string[] = [''];  // Start with root (empty string)
      const pathRegex = /([^.\[\]]+)|\[(\d+)\]/g;
      let match;
      let currentPath = '';
      
      while ((match = pathRegex.exec(normalizedPath)) !== null) {
        if (match[1] !== undefined) {
          // Regular property
          currentPath = currentPath ? `${currentPath}.${match[1]}` : match[1];
          parts.push(currentPath);
        } else if (match[2] !== undefined) {
          // Array index
          currentPath = `${currentPath}[${match[2]}]`;
          parts.push(currentPath);
        }
      }
      
      return parts;
    };
    
    for (const error of errors) {
      // Errors are already normalized to frontend format
      const normalizedPath = error.path;
      
      // Build all path segments including the full path and root
      const allPaths = buildParentPaths(normalizedPath);
      
      // Count for all paths (leaf node and all parent paths including root)
      for (const path of allPaths) {
        counts.set(path, (counts.get(path) || 0) + 1);
      }
    }
    
    return counts;
  }, [errors]);

  const getErrorCountForPath = useCallback((path: string): number => {
    return errorCountByPath.get(path) || 0;
  }, [errorCountByPath]);

  return (
    <DataContext.Provider
      value={{
        schema,
        config,
        data,
        errors,
        loading,
        dirty,
        selectedPath,
        expandedPaths,
        setSelectedPath,
        toggleExpanded,
        expandPath,
        updateValue,
        saveData,
        resetData,
        refresh,
        getErrorCountForPath,
        errorCountByPath,
        setExternalErrors,
        clearErrors,
        setExternalData,
        apiBase,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
}

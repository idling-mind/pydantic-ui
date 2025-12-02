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
}

const DataContext = createContext<DataContextValue | null>(null);

interface DataProviderProps {
  children: React.ReactNode;
  apiBase?: string;
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
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['root']));

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
      setData(dataRes.data);
      setOriginalData(dataRes.data);
      setErrors([]);
      setDirty(false);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    // Mark as dirty and clear errors when user makes changes
    setDirty(true);
    setErrors([]);
  }, []);

  const saveData = useCallback(async (): Promise<boolean> => {
    try {
      const result = await api.updateData(data);
      if (result.valid) {
        setData(result.data);
        setOriginalData(result.data);
        setErrors([]);
        setDirty(false);
        return true;
      } else {
        setErrors(result.errors || []);
        return false;
      }
    } catch (error) {
      console.error('Failed to save data:', error);
      return false;
    }
  }, [api, data]);

  const resetData = useCallback(() => {
    setData(originalData);
    setErrors([]);
    setDirty(false);
  }, [originalData]);

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

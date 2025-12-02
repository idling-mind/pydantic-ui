import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { Schema, UIConfig, FieldError } from '@/types';
import { createApiClient } from '@/api';

interface DataContextValue {
  schema: Schema | null;
  config: UIConfig | null;
  data: Record<string, unknown>;
  errors: FieldError[];
  loading: boolean;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  setSelectedPath: (path: string | null) => void;
  toggleExpanded: (path: string) => void;
  expandPath: (path: string) => void;
  updateValue: (path: string, value: unknown) => Promise<void>;
  saveData: () => Promise<boolean>;
  resetData: () => Promise<void>;
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

  const updateValue = useCallback(async (path: string, value: unknown) => {
    try {
      const result = await api.partialUpdate(path, value);
      setData(result.data);
      if (result.errors) {
        setErrors(result.errors);
      } else {
        setErrors([]);
      }
    } catch (error) {
      console.error('Failed to update value:', error);
    }
  }, [api]);

  const saveData = useCallback(async (): Promise<boolean> => {
    try {
      const result = await api.updateData(data);
      if (result.valid) {
        setData(result.data);
        setOriginalData(result.data);
        setErrors([]);
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

  const resetData = useCallback(async () => {
    setData(originalData);
    setErrors([]);
  }, [originalData]);

  return (
    <DataContext.Provider
      value={{
        schema,
        config,
        data,
        errors,
        loading,
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

import { useCallback } from 'react';
import { useData } from '@/context/DataContext';
import { useClipboard } from '@/context/ClipboardContext';
import { useEvents } from '@/context/EventContext';
import { resolveDisplay } from '@/lib/displayUtils';
import type { SchemaField } from '@/types';
import type { PasteFieldSelection } from './PasteSelectedDialog';
import type { PasteArrayMode } from './PasteArrayDialog';

// Helper to get value at a path
export function getValueAtPath(data: unknown, path: string): unknown {
  if (!path || !data) return data;
  
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

  let current: unknown = data;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    
    if (part.isIndex) {
      const index = parseInt(part.key, 10);
      if (Array.isArray(current)) {
        current = current[index];
      } else {
        return undefined;
      }
    } else {
      current = (current as Record<string, unknown>)[part.key];
    }
  }
  
  return current;
}

// Helper to get value at a nested path within an object
function getNestedValue(data: unknown, path: string): unknown {
  if (!path) return data;
  const parts = path.split('.');
  let current = data;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// Helper to set value at a nested path within an object (returns new object)
function setNestedValue(data: unknown, path: string, value: unknown): unknown {
  if (!path) return value;
  
  const parts = path.split('.');
  const result = JSON.parse(JSON.stringify(data || {})); // Deep clone
  
  let current = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }
  
  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
  
  return result;
}

// Helper to get schema at a path
export function getSchemaAtPath(rootSchema: SchemaField | null, path: string): SchemaField | null {
  if (!rootSchema) return null;
  if (!path) return rootSchema;
  
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

  let current: SchemaField | null = rootSchema;
  for (const part of parts) {
    if (!current) return null;
    
    if (part.isIndex) {
      // Array index - get items schema
      if (current.type === 'array' && current.items) {
        current = current.items;
      } else {
        return null;
      }
    } else {
      // Object field
      if (current.type === 'object' && current.fields && current.fields[part.key]) {
        current = current.fields[part.key];
      } else {
        return null;
      }
    }
  }
  
  return current;
}

// Helper to parse parent array info from path
export function parseParentArrayInfo(path: string): { parentArrayPath: string; arrayIndex: number } | null {
  const arrayIndexMatch = path.match(/^(.+)\[(\d+)\]$/);
  if (arrayIndexMatch) {
    return {
      parentArrayPath: arrayIndexMatch[1],
      arrayIndex: parseInt(arrayIndexMatch[2], 10),
    };
  }
  return null;
}

// Helper to get node name from path (fallback when no data is available)
export function getNodeNameFromPath(path: string, fieldSchema: SchemaField | null): string {
  if (!path) return fieldSchema?.title || 'Root';
  
  const arrayMatch = path.match(/\[(\d+)\]$/);
  if (arrayMatch) {
    return `Item ${parseInt(arrayMatch[1], 10) + 1}`;
  }
  
  const parts = path.split('.');
  const lastName = parts[parts.length - 1];
  return fieldSchema?.title || lastName;
}

// Helper to get display name that matches what's shown in the tree
export function getDisplayName(path: string, schema: SchemaField, data: unknown): string {
  // Extract the field name from the path
  const arrayMatch = path.match(/\[(\d+)\]$/);
  let name: string;
  
  if (!path) {
    name = 'Root';
  } else if (arrayMatch) {
    name = `Item ${parseInt(arrayMatch[1], 10) + 1}`;
  } else {
    const parts = path.split('.');
    name = parts[parts.length - 1];
  }
  
  // Use resolveDisplay to get the same title shown in the tree
  const display = resolveDisplay({
    schema,
    view: 'tree',
    name,
    data,
  });
  
  return display.title;
}

interface UseTreeActionsOptions {
  path: string;
  schema: SchemaField;
  currentValue: unknown;
  selectedPaths?: string[];
}

/**
 * Shared hook for tree node actions (copy, paste, clear, delete).
 * Used by both TreeNodeContextMenu (for right-click) and TreePanel (for keyboard shortcuts).
 */
export function useTreeActions({ path, schema, currentValue, selectedPaths = [] }: UseTreeActionsOptions) {
  const { clipboard, copy, canPaste, canPasteToArray } = useClipboard();
  const { data, updateValue, setSelectedPath } = useData();
  const { addToast } = useEvents();

  // Copy the current node
  const handleCopy = useCallback(() => {
    const displayName = getDisplayName(path, schema, currentValue);
    copy(path, currentValue, schema, displayName);
    addToast({
      message: `Copied: ${displayName}`,
      type: 'info',
      duration: 2000,
    });
  }, [copy, path, currentValue, schema, addToast]);

  // Execute simple paste (overwrite)
  const executePaste = useCallback(() => {
    if (!clipboard) return;

    const valueToPaste = clipboard.data;
    
    if (selectedPaths.length > 1) {
      // Multi-paste
      for (const targetPath of selectedPaths) {
        if (targetPath === '') {
          const merged = valueToPaste as Record<string, unknown>;
          for (const key of Object.keys(merged)) {
            updateValue(key, merged[key]);
          }
        } else {
          updateValue(targetPath, valueToPaste);
        }
      }
    } else {
      // Single paste
      if (path === '') {
        const merged = { ...data, ...(valueToPaste as Record<string, unknown>) };
        for (const key of Object.keys(merged)) {
          updateValue(key, merged[key]);
        }
      } else {
        updateValue(path, valueToPaste);
      }
    }
  }, [clipboard, path, data, updateValue, selectedPaths]);

  // Paste selected fields with optional array modes
  const handlePasteSelected = useCallback((selections: PasteFieldSelection[]) => {
    if (!clipboard) return;

    const sourceData = clipboard.data;
    
    const pastePartialData = (targetPath: string) => {
      let targetValue = targetPath === '' 
        ? { ...data } 
        : JSON.parse(JSON.stringify(getValueAtPath(data, targetPath) || {}));
      
      for (const selection of selections) {
        const fieldPath = selection.path;
        const fieldValue = getNestedValue(sourceData, fieldPath);
        
        if (selection.arrayMode && Array.isArray(fieldValue)) {
          const existingArray = getNestedValue(targetValue, fieldPath);
          const targetArray = Array.isArray(existingArray) ? existingArray : [];
          const sourceArray = JSON.parse(JSON.stringify(fieldValue));
          
          let newArray: unknown[];
          switch (selection.arrayMode) {
            case 'append':
              newArray = [...targetArray, ...sourceArray];
              break;
            case 'prepend':
              newArray = [...sourceArray, ...targetArray];
              break;
            case 'overwrite':
            default:
              newArray = sourceArray;
              break;
          }
          targetValue = setNestedValue(targetValue, fieldPath, newArray);
        } else {
          targetValue = setNestedValue(targetValue, fieldPath, fieldValue);
        }
      }
      
      return targetValue;
    };

    const targetPaths = selectedPaths.length > 1 ? selectedPaths : [path];
    for (const targetPath of targetPaths) {
      const newValue = pastePartialData(targetPath);
      if (targetPath === '') {
        for (const key of Object.keys(newValue as Record<string, unknown>)) {
          updateValue(key, (newValue as Record<string, unknown>)[key]);
        }
      } else {
        updateValue(targetPath, newValue);
      }
    }
  }, [clipboard, path, data, updateValue, selectedPaths]);

  // Paste array with mode (append, prepend, overwrite)
  const handlePasteArray = useCallback((mode: PasteArrayMode) => {
    if (!clipboard) return;

    const sourceArray = Array.isArray(clipboard.data) ? clipboard.data : [];
    const targetArray = Array.isArray(currentValue) ? currentValue : [];
    
    let newArray: unknown[];
    
    switch (mode) {
      case 'append':
        newArray = [...targetArray, ...JSON.parse(JSON.stringify(sourceArray))];
        break;
      case 'prepend':
        newArray = [...JSON.parse(JSON.stringify(sourceArray)), ...targetArray];
        break;
      case 'overwrite':
        newArray = JSON.parse(JSON.stringify(sourceArray));
        break;
      default:
        newArray = [...targetArray];
    }
    
    updateValue(path, newArray);
  }, [clipboard, currentValue, path, updateValue]);

  // Paste as new item in an array
  const handlePasteAsNewItem = useCallback(() => {
    if (!clipboard) return;

    const valueToPaste = clipboard.data;
    const currentArray = Array.isArray(currentValue) ? [...currentValue] : [];
    currentArray.push(JSON.parse(JSON.stringify(valueToPaste)));
    updateValue(path, currentArray);
  }, [clipboard, currentValue, path, updateValue]);

  // Clear the current value
  const handleClear = useCallback(() => {
    if (path === '') {
      // Clearing root - update each top-level field
      if (schema?.fields) {
        for (const key of Object.keys(schema.fields)) {
          updateValue(key, null);
        }
      }
    } else {
      updateValue(path, null);
    }
  }, [path, schema, updateValue]);

  // Delete array item
  const handleDelete = useCallback(() => {
    const parentInfo = parseParentArrayInfo(path);
    if (!parentInfo) return;
    
    const { parentArrayPath, arrayIndex } = parentInfo;
    const parentArray = getValueAtPath(data, parentArrayPath);
    
    if (!Array.isArray(parentArray)) return;
    
    const newArray = [...parentArray];
    newArray.splice(arrayIndex, 1);
    updateValue(parentArrayPath, newArray);
    
    // Select parent array after deletion
    setSelectedPath(parentArrayPath);
  }, [path, data, updateValue, setSelectedPath]);

  // Duplicate array item(s)
  const handleDuplicate = useCallback((count: number, placement: 'after-each' | 'at-end', paths?: string[]) => {
    // Collect all target paths (multi-select or single)
    const targetPaths = (paths && paths.length > 0) ? paths : [path];

    // Parse and group by parent array
    const items: { parentArrayPath: string; arrayIndex: number }[] = [];
    for (const p of targetPaths) {
      const info = parseParentArrayInfo(p);
      if (info) items.push(info);
    }

    if (items.length === 0) return;

    // Group by parent array
    const byParent = new Map<string, number[]>();
    for (const { parentArrayPath: pap, arrayIndex: ai } of items) {
      const existing = byParent.get(pap);
      if (existing) {
        existing.push(ai);
      } else {
        byParent.set(pap, [ai]);
      }
    }

    for (const [parentPath, indices] of byParent) {
      const parentArray = getValueAtPath(data, parentPath);
      if (!Array.isArray(parentArray)) continue;

      const newArray = [...parentArray];

      if (placement === 'at-end') {
        // Append all clones at the end of the array
        const sortedIndices = [...indices].sort((a, b) => a - b);
        for (const idx of sortedIndices) {
          if (idx < 0 || idx >= parentArray.length) continue;
          const clones = Array.from({ length: count }, () =>
            JSON.parse(JSON.stringify(parentArray[idx]))
          );
          newArray.push(...clones);
        }
      } else {
        // Insert after each original item (sort descending so inserts don't shift pending indices)
        const sortedIndices = [...indices].sort((a, b) => b - a);
        for (const idx of sortedIndices) {
          if (idx < 0 || idx >= newArray.length) continue;
          const clones = Array.from({ length: count }, () =>
            JSON.parse(JSON.stringify(newArray[idx]))
          );
          newArray.splice(idx + 1, 0, ...clones);
        }
      }

      updateValue(parentPath, newArray);
    }
  }, [path, data, updateValue]);

  // Check if the current node is a duplicatable array item
  const canDuplicate = parseParentArrayInfo(path) !== null;

  return {
    clipboard,
    canPaste: canPaste(schema),
    canPasteToArray: canPasteToArray(schema),
    canDuplicate,
    handleCopy,
    executePaste,
    handlePasteSelected,
    handlePasteArray,
    handlePasteAsNewItem,
    handleClear,
    handleDelete,
    handleDuplicate,
  };
}

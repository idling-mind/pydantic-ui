import React, { useState, useCallback } from 'react';
import { Copy, ClipboardPaste, ClipboardList, Trash2, Plus } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useClipboard } from '@/context/ClipboardContext';
import { useData } from '@/context/DataContext';
import { PasteSelectedDialog, type PasteFieldSelection } from './PasteSelectedDialog';
import { PasteArrayDialog, type PasteArrayMode } from './PasteArrayDialog';
import type { SchemaField } from '@/types';

interface TreeNodeContextMenuProps {
  children: React.ReactNode;
  path: string;
  schema: SchemaField;
  nodeName: string;
  // Multi-select support
  selectedPaths?: string[];
  onMultiPaste?: (paths: string[], data: unknown) => void;
  // Parent array path for array items (for delete functionality)
  parentArrayPath?: string;
  // Index in parent array (for delete functionality)
  arrayIndex?: number;
}

// Helper to get value at a path
function getValueAtPath(data: unknown, path: string): unknown {
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

export function TreeNodeContextMenu({
  children,
  path,
  schema,
  nodeName,
  selectedPaths = [],
  onMultiPaste,
  parentArrayPath,
  arrayIndex,
}: TreeNodeContextMenuProps) {
  const { clipboard, copy, canPaste, canPasteToArray } = useClipboard();
  const { data, updateValue } = useData();
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const [pasteArrayDialogOpen, setPasteArrayDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [pasteOverwriteDialogOpen, setPasteOverwriteDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Get the current value at this path
  const currentValue = React.useMemo(() => {
    if (path === '') {
      return data;
    }
    return getValueAtPath(data, path);
  }, [data, path]);

  const handleCopy = useCallback(() => {
    const schemaName = schema.title || nodeName;
    copy(path, currentValue, schema, schemaName);
  }, [copy, path, currentValue, schema, nodeName]);

  // Execute the paste operation
  const executePaste = useCallback(() => {
    if (!clipboard) return;

    const valueToPaste = clipboard.data;
    
    // If we have multiple selected paths, paste to all of them
    if (selectedPaths.length > 1 && onMultiPaste) {
      onMultiPaste(selectedPaths, valueToPaste);
    } else {
      // Single paste
      if (path === '') {
        // Pasting to root - merge the data
        const merged = { ...data, ...(valueToPaste as Record<string, unknown>) };
        for (const key of Object.keys(merged)) {
          updateValue(key, merged[key]);
        }
      } else {
        updateValue(path, valueToPaste);
      }
    }
  }, [clipboard, path, data, updateValue, selectedPaths, onMultiPaste]);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;
    
    // Show confirmation dialog when overwriting existing data
    setPasteOverwriteDialogOpen(true);
  }, [clipboard]);

  const handleConfirmPaste = useCallback(() => {
    executePaste();
    setPasteOverwriteDialogOpen(false);
  }, [executePaste]);

  // Handle pasting an object as a new item in an array
  const handlePasteAsNewItem = useCallback(() => {
    if (!clipboard) return;

    const valueToPaste = clipboard.data;
    const currentArray = Array.isArray(currentValue) ? [...currentValue] : [];
    currentArray.push(JSON.parse(JSON.stringify(valueToPaste)));
    updateValue(path, currentArray);
  }, [clipboard, currentValue, path, updateValue]);

  // Handle deleting an item from its parent array
  const handleDelete = useCallback(() => {
    if (parentArrayPath === undefined || arrayIndex === undefined) return;
    
    const parentArray = getValueAtPath(data, parentArrayPath);
    if (!Array.isArray(parentArray)) return;
    
    const newArray = [...parentArray];
    newArray.splice(arrayIndex, 1);
    updateValue(parentArrayPath, newArray);
    setDeleteDialogOpen(false);
  }, [parentArrayPath, arrayIndex, data, updateValue]);

  const handlePasteSelected = useCallback((selections: PasteFieldSelection[]) => {
    if (!clipboard) return;

    const sourceData = clipboard.data;
    
    // Build the partial data to paste based on selected paths
    const pastePartialData = (targetPath: string) => {
      let targetValue = targetPath === '' ? { ...data } : JSON.parse(JSON.stringify(getValueAtPath(data, targetPath) || {}));
      
      for (const selection of selections) {
        const fieldPath = selection.path;
        const fieldValue = getNestedValue(sourceData, fieldPath);
        
        // Handle array fields with modes
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

    // If we have multiple selected paths, paste to all of them
    if (selectedPaths.length > 1) {
      for (const targetPath of selectedPaths) {
        const newValue = pastePartialData(targetPath);
        if (targetPath === '') {
          for (const key of Object.keys(newValue)) {
            updateValue(key, newValue[key]);
          }
        } else {
          updateValue(targetPath, newValue);
        }
      }
    } else {
      // Single paste
      const newValue = pastePartialData(path);
      if (path === '') {
        for (const key of Object.keys(newValue)) {
          updateValue(key, newValue[key]);
        }
      } else {
        updateValue(path, newValue);
      }
    }
  }, [clipboard, path, data, updateValue, selectedPaths]);

  // Handle pasting array with mode (append, prepend, overwrite)
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

  // Helper to create a cleared value based on schema type
  const createClearedValue = useCallback((fieldSchema: SchemaField): unknown => {
    // If schema has a default value, use it (deep clone for objects/arrays)
    if (fieldSchema.default !== undefined) {
      if (fieldSchema.default === null) {
        // If default is null, check if it's because it's required (no default) or optional (default None)
        // If required is true, default=null means "no default" (PydanticUndefined)
        // If required is false, default=null means "None"
        if (fieldSchema.required !== true) {
          return null;
        }
        // If required is true, fall through to type-based clearing
      } else {
        return JSON.parse(JSON.stringify(fieldSchema.default));
      }
    }

    switch (fieldSchema.type) {
      case 'object':
        // For objects, recursively clear fields
        if (fieldSchema.fields) {
          const cleared: Record<string, unknown> = {};
          for (const [key, subSchema] of Object.entries(fieldSchema.fields)) {
            cleared[key] = createClearedValue(subSchema);
          }
          return cleared;
        }
        return {};
      case 'array':
        return [];
      case 'string':
        return '';
      case 'integer':
      case 'number':
        return null;
      case 'boolean':
        return false;
      default:
        return null;
    }
  }, []);

  const handleClear = useCallback(() => {
    if (path === '') {
      // Clearing root - update each top-level field based on schema
      if (schema.fields) {
        for (const [key, fieldSchema] of Object.entries(schema.fields)) {
          updateValue(key, createClearedValue(fieldSchema));
        }
      }
    } else {
      const clearedValue = createClearedValue(schema);
      updateValue(path, clearedValue);
    }
    
    setClearDialogOpen(false);
  }, [path, schema, updateValue, createClearedValue]);

  const isCompatibleForPaste = canPaste(schema);
  const isCompatibleForPasteToArray = canPasteToArray(schema);
  const hasClipboard = !!clipboard;
  const isObjectType = schema.type === 'object';
  const isArrayType = schema.type === 'array';
  const isClearable = isObjectType || isArrayType;
  const targetCount = selectedPaths.length > 1 ? selectedPaths.length : 1;
  // Can delete if this is an array item (has parent array path and index)
  const canDelete = parentArrayPath !== undefined && arrayIndex !== undefined;

  return (
    <>
      <ContextMenu>
        {children}
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
            <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>
          
          <ContextMenuSeparator />
          
          <ContextMenuItem
            onClick={handlePaste}
            disabled={!hasClipboard || !isCompatibleForPaste}
          >
            <ClipboardPaste className="mr-2 h-4 w-4" />
            Paste{targetCount > 1 ? ` (${targetCount} targets)` : ''}
            <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>
          
          <ContextMenuItem
            onClick={() => {
              if (isArrayType && isCompatibleForPaste) {
                setPasteArrayDialogOpen(true);
              } else {
                setPasteDialogOpen(true);
              }
            }}
            disabled={!hasClipboard || !isCompatibleForPaste || (!isObjectType && !isArrayType)}
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Paste Selected...
          </ContextMenuItem>

          {/* Paste as new array item */}
          <ContextMenuItem
            onClick={handlePasteAsNewItem}
            disabled={!hasClipboard || !isCompatibleForPasteToArray}
          >
            <Plus className="mr-2 h-4 w-4" />
            Paste as New Item
          </ContextMenuItem>
          
          <ContextMenuSeparator />
          
          <ContextMenuItem
            onClick={() => setClearDialogOpen(true)}
            disabled={!isClearable}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Values
          </ContextMenuItem>

          {/* Delete array item */}
          {canDelete && (
            <ContextMenuItem
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Item
            </ContextMenuItem>
          )}
          
          {clipboard && (
            <>
              <ContextMenuSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Clipboard: {clipboard.schemaName}
                {!isCompatibleForPaste && !isCompatibleForPasteToArray && (
                  <span className="block text-destructive">
                    (incompatible type)
                  </span>
                )}
              </div>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {clipboard && (
        <PasteSelectedDialog
          open={pasteDialogOpen}
          onOpenChange={setPasteDialogOpen}
          sourceData={clipboard.data}
          sourceSchema={clipboard.schema}
          targetPaths={selectedPaths.length > 1 ? selectedPaths : [path]}
          onPaste={handlePasteSelected}
        />
      )}

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear "{nodeName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all values within "{nodeName}" and reset them to their default empty state.
              {isArrayType ? ' All items in the array will be removed.' : ' All sub-fields will be cleared.'}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClear}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear Values
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Paste overwrite confirmation dialog */}
      <AlertDialog open={pasteOverwriteDialogOpen} onOpenChange={setPasteOverwriteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Paste to "{nodeName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the current values in "{nodeName}" with the data from the clipboard
              {clipboard ? ` (${clipboard.schemaName})` : ''}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPaste}>
              Paste
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete array item confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{nodeName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{nodeName}" from the list.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Paste array dialog with append/prepend/overwrite options */}
      {clipboard && (
        <PasteArrayDialog
          open={pasteArrayDialogOpen}
          onOpenChange={setPasteArrayDialogOpen}
          sourceItemCount={Array.isArray(clipboard.data) ? clipboard.data.length : 0}
          targetItemCount={Array.isArray(currentValue) ? currentValue.length : 0}
          targetName={nodeName}
          onPaste={handlePasteArray}
        />
      )}
    </>
  );
}

import React, { useState, useCallback } from 'react';
import { Copy, ClipboardPaste, ClipboardList } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/components/ui/context-menu';
import { useClipboard } from '@/context/ClipboardContext';
import { useData } from '@/context/DataContext';
import { PasteSelectedDialog } from './PasteSelectedDialog';
import type { SchemaField } from '@/types';

interface TreeNodeContextMenuProps {
  children: React.ReactNode;
  path: string;
  schema: SchemaField;
  nodeName: string;
  // Multi-select support
  selectedPaths?: string[];
  onMultiPaste?: (paths: string[], data: unknown) => void;
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
}: TreeNodeContextMenuProps) {
  const { clipboard, copy, canPaste } = useClipboard();
  const { data, updateValue } = useData();
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);

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

  const handlePaste = useCallback(() => {
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

  const handlePasteSelected = useCallback((selectedFieldPaths: string[]) => {
    if (!clipboard) return;

    const sourceData = clipboard.data;
    
    // Build the partial data to paste based on selected paths
    const pastePartialData = (targetPath: string) => {
      let targetValue = targetPath === '' ? { ...data } : JSON.parse(JSON.stringify(getValueAtPath(data, targetPath) || {}));
      
      for (const fieldPath of selectedFieldPaths) {
        const fieldValue = getNestedValue(sourceData, fieldPath);
        targetValue = setNestedValue(targetValue, fieldPath, fieldValue);
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

  const isCompatibleForPaste = canPaste(schema);
  const hasClipboard = !!clipboard;
  const isObjectType = schema.type === 'object';
  const targetCount = selectedPaths.length > 1 ? selectedPaths.length : 1;

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
            onClick={() => setPasteDialogOpen(true)}
            disabled={!hasClipboard || !isCompatibleForPaste || !isObjectType}
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Paste Selected...
          </ContextMenuItem>
          
          {clipboard && (
            <>
              <ContextMenuSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Clipboard: {clipboard.schemaName}
                {!isCompatibleForPaste && (
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
    </>
  );
}

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
import { useData } from '@/context/DataContext';
import { PasteSelectedDialog } from './PasteSelectedDialog';
import { PasteArrayDialog } from './PasteArrayDialog';
import { useTreeActions, getValueAtPath } from './useTreeActions';
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

export function TreeNodeContextMenu({
  children,
  path,
  schema,
  nodeName,
  selectedPaths = [],
  onMultiPaste: _onMultiPaste,
  parentArrayPath,
  arrayIndex,
}: TreeNodeContextMenuProps) {
  const { data } = useData();
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

  // Use shared tree actions hook
  const {
    clipboard,
    canPaste: isCompatibleForPaste,
    canPasteToArray: isCompatibleForPasteToArray,
    handleCopy,
    executePaste,
    handlePasteSelected,
    handlePasteArray,
    handlePasteAsNewItem,
    handleClear,
    handleDelete: deleteFromArray,
  } = useTreeActions({
    path,
    schema,
    currentValue,
    selectedPaths,
  });

  const handlePaste = useCallback(() => {
    if (!clipboard) return;
    // Show confirmation dialog when overwriting existing data
    setPasteOverwriteDialogOpen(true);
  }, [clipboard]);

  const handleConfirmPaste = useCallback(() => {
    executePaste();
    setPasteOverwriteDialogOpen(false);
  }, [executePaste]);

  const handleClearWithDialog = useCallback(() => {
    handleClear();
    setClearDialogOpen(false);
  }, [handleClear]);

  const handleDeleteWithDialog = useCallback(() => {
    deleteFromArray();
    setDeleteDialogOpen(false);
  }, [deleteFromArray]);

  const hasClipboard = !!clipboard;
  const isObjectType = schema.type === 'object';
  const isArrayType = schema.type === 'array';
  // All fields are clearable from the context menu (not just objects/arrays)
  const isClearable = true;
  const targetCount = selectedPaths.length > 1 ? selectedPaths.length : 1;
  // Can delete if this is an array item (has parent array path and index)
  const canDelete = parentArrayPath !== undefined && arrayIndex !== undefined;

  return (
    <>
      <ContextMenu>
        {children}
        <ContextMenuContent className="w-64">
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
            Paste Selected
            <ContextMenuShortcut>Ctrl+Shift+V</ContextMenuShortcut>
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
            Clear Value
            <ContextMenuShortcut>Shift+Del</ContextMenuShortcut>
          </ContextMenuItem>

          {/* Delete array item */}
          {canDelete && (
            <ContextMenuItem
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Item
              <ContextMenuShortcut>Del</ContextMenuShortcut>
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
              This will clear the value of "{nodeName}" and set it to empty/null.
              {isArrayType && ' All items in the array will be removed.'}
              {isObjectType && ' All sub-fields will be cleared.'}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearWithDialog}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear Value
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
              onClick={handleDeleteWithDialog}
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

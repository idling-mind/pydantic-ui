import React, { useState, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronDown, MinusSquare, Square, CheckSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { SchemaField } from '@/types';

interface FieldTreeNode {
  path: string;
  name: string;
  type: string;
  children: FieldTreeNode[];
  isLeaf: boolean;
}

interface PasteSelectedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceData: unknown;
  sourceSchema: SchemaField;
  targetPaths: string[];
  onPaste: (selectedPaths: string[]) => void;
}

// Build a tree structure from the schema for field selection
function buildFieldTree(
  schema: SchemaField,
  data: unknown,
  basePath: string = '',
  name: string = 'root'
): FieldTreeNode {
  const children: FieldTreeNode[] = [];
  const isObject = schema.type === 'object' && schema.fields;

  if (isObject && schema.fields) {
    for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
      const fieldPath = basePath ? `${basePath}.${fieldName}` : fieldName;
      const fieldData = data && typeof data === 'object' ? (data as Record<string, unknown>)[fieldName] : undefined;

      // Skip arrays - we don't allow selecting individual array items for paste selected
      if (fieldSchema.type === 'array') {
        continue;
      }

      children.push(buildFieldTree(fieldSchema, fieldData, fieldPath, fieldName));
    }
  }

  return {
    path: basePath,
    name,
    type: schema.type,
    children,
    isLeaf: children.length === 0 || schema.type !== 'object',
  };
}

// Get all leaf paths from a tree node
function getAllLeafPaths(node: FieldTreeNode): string[] {
  if (node.isLeaf && node.path) {
    return [node.path];
  }
  return node.children.flatMap(getAllLeafPaths);
}

// Get all descendant paths (both leaf and intermediate)
function getAllDescendantPaths(node: FieldTreeNode): string[] {
  const paths: string[] = [];
  if (node.path) {
    paths.push(node.path);
  }
  for (const child of node.children) {
    paths.push(...getAllDescendantPaths(child));
  }
  return paths;
}

interface FieldTreeItemProps {
  node: FieldTreeNode;
  selectedPaths: Set<string>;
  expandedPaths: Set<string>;
  onToggleSelect: (path: string, node: FieldTreeNode) => void;
  onToggleExpand: (path: string) => void;
  depth: number;
}

function FieldTreeItem({
  node,
  selectedPaths,
  expandedPaths,
  onToggleSelect,
  onToggleExpand,
  depth,
}: FieldTreeItemProps) {
  const isExpanded = expandedPaths.has(node.path);
  const hasChildren = node.children.length > 0;
  
  // Check selection state
  const allLeafPaths = useMemo(() => getAllLeafPaths(node), [node]);
  const selectedLeafCount = allLeafPaths.filter(p => selectedPaths.has(p)).length;
  const isFullySelected = allLeafPaths.length > 0 && selectedLeafCount === allLeafPaths.length;
  const isPartiallySelected = selectedLeafCount > 0 && selectedLeafCount < allLeafPaths.length;
  const isSelected = node.isLeaf ? selectedPaths.has(node.path) : isFullySelected;

  const getCheckboxIcon = () => {
    if (isPartiallySelected) {
      return <MinusSquare className="h-4 w-4 text-primary" />;
    }
    if (isSelected) {
      return <CheckSquare className="h-4 w-4 text-primary" />;
    }
    return <Square className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-sm cursor-pointer',
          'hover:bg-accent hover:text-accent-foreground',
          'transition-colors duration-150'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse button */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.path);
            }}
            className="p-0.5 hover:bg-muted rounded shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(node.path, node);
          }}
          className="p-0.5 hover:bg-muted rounded shrink-0"
        >
          {getCheckboxIcon()}
        </button>

        {/* Name and type */}
        <span
          className="truncate flex-1"
          onClick={() => onToggleSelect(node.path, node)}
        >
          {node.name}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">
          {node.type}
        </span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <FieldTreeItem
              key={child.path}
              node={child}
              selectedPaths={selectedPaths}
              expandedPaths={expandedPaths}
              onToggleSelect={onToggleSelect}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PasteSelectedDialog({
  open,
  onOpenChange,
  sourceData,
  sourceSchema,
  targetPaths,
  onPaste,
}: PasteSelectedDialogProps) {
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['']));

  // Build the field tree
  const fieldTree = useMemo(() => {
    return buildFieldTree(sourceSchema, sourceData);
  }, [sourceSchema, sourceData]);

  // Reset selection when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedPaths(new Set());
      // Expand all by default
      const allPaths = getAllDescendantPaths(fieldTree);
      setExpandedPaths(new Set(allPaths));
    }
  }, [open, fieldTree]);

  const handleToggleSelect = useCallback((_path: string, node: FieldTreeNode) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      const leafPaths = getAllLeafPaths(node);
      const allSelected = leafPaths.every(p => prev.has(p));

      if (allSelected) {
        // Deselect all leaf paths
        for (const p of leafPaths) {
          next.delete(p);
        }
      } else {
        // Select all leaf paths
        for (const p of leafPaths) {
          next.add(p);
        }
      }

      return next;
    });
  }, []);

  const handleToggleExpand = useCallback((path: string) => {
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

  const handleSelectAll = useCallback(() => {
    const allLeafPaths = getAllLeafPaths(fieldTree);
    setSelectedPaths(new Set(allLeafPaths));
  }, [fieldTree]);

  const handleSelectNone = useCallback(() => {
    setSelectedPaths(new Set());
  }, []);

  const handlePaste = useCallback(() => {
    onPaste(Array.from(selectedPaths));
    onOpenChange(false);
  }, [selectedPaths, onPaste, onOpenChange]);

  const targetCount = targetPaths.length;
  const selectedCount = selectedPaths.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Paste Selected Fields</DialogTitle>
          <DialogDescription>
            Select which fields to paste to {targetCount} target{targetCount !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2 border-b">
          <span className="text-sm text-muted-foreground">
            {selectedCount} field{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSelectNone}>
              Clear
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[300px] border rounded-md">
          <div className="p-2">
            {fieldTree.children.length > 0 ? (
              fieldTree.children.map((child) => (
                <FieldTreeItem
                  key={child.path}
                  node={child}
                  selectedPaths={selectedPaths}
                  expandedPaths={expandedPaths}
                  onToggleSelect={handleToggleSelect}
                  onToggleExpand={handleToggleExpand}
                  depth={0}
                />
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4">
                No selectable fields
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePaste} disabled={selectedCount === 0}>
            Paste {selectedCount > 0 ? `(${selectedCount} fields)` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

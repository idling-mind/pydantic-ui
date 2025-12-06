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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { SchemaField } from '@/types';

export type ArrayPasteMode = 'append' | 'prepend' | 'overwrite';

interface FieldTreeNode {
  path: string;
  name: string;
  type: string;
  children: FieldTreeNode[];
  isLeaf: boolean;
  isArray: boolean;
  arrayLength?: number;
}

export interface PasteFieldSelection {
  path: string;
  arrayMode?: ArrayPasteMode;
}

interface PasteSelectedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceData: unknown;
  sourceSchema: SchemaField;
  targetPaths: string[];
  onPaste: (selections: PasteFieldSelection[]) => void;
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

      // Arrays are treated as leaf nodes - the entire array can be selected but not individual items
      if (fieldSchema.type === 'array') {
        const arrayLength = Array.isArray(fieldData) ? fieldData.length : 0;
        children.push({
          path: fieldPath,
          name: fieldName,
          type: 'array',
          children: [],
          isLeaf: true,
          isArray: true,
          arrayLength,
        });
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
    isArray: false,
  };
}

// Get all leaf paths from a tree node
function getAllLeafPaths(node: FieldTreeNode): string[] {
  if (node.isLeaf && node.path) {
    return [node.path];
  }
  return node.children.flatMap(getAllLeafPaths);
}

// Get all array paths from a tree node
function getAllArrayPaths(node: FieldTreeNode): string[] {
  const paths: string[] = [];
  if (node.isArray && node.path) {
    paths.push(node.path);
  }
  for (const child of node.children) {
    paths.push(...getAllArrayPaths(child));
  }
  return paths;
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
  arrayModes: Map<string, ArrayPasteMode>;
  onToggleSelect: (path: string, node: FieldTreeNode) => void;
  onToggleExpand: (path: string) => void;
  onArrayModeChange: (path: string, mode: ArrayPasteMode) => void;
  depth: number;
}

function FieldTreeItem({
  node,
  selectedPaths,
  expandedPaths,
  arrayModes,
  onToggleSelect,
  onToggleExpand,
  onArrayModeChange,
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

  const currentArrayMode = arrayModes.get(node.path) || 'overwrite';

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-sm',
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
            className="p-0.5 hover:bg-muted rounded shrink-0 cursor-pointer"
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
          className="p-0.5 hover:bg-muted rounded shrink-0 cursor-pointer"
        >
          {getCheckboxIcon()}
        </button>

        {/* Name */}
        <span
          className="truncate flex-1 cursor-pointer"
          onClick={() => onToggleSelect(node.path, node)}
        >
          {node.name}
        </span>

        {/* Array mode dropdown or type label */}
        {node.isArray && isSelected ? (
          <Select
            value={currentArrayMode}
            onValueChange={(value) => onArrayModeChange(node.path, value as ArrayPasteMode)}
          >
            <SelectTrigger 
              className="h-6 w-24 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="append">Append</SelectItem>
              <SelectItem value="prepend">Prepend</SelectItem>
              <SelectItem value="overwrite">Overwrite</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground shrink-0">
            {node.isArray ? `array[${node.arrayLength}]` : node.type}
          </span>
        )}
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
              arrayModes={arrayModes}
              onToggleSelect={onToggleSelect}
              onToggleExpand={onToggleExpand}
              onArrayModeChange={onArrayModeChange}
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
  const [arrayModes, setArrayModes] = useState<Map<string, ArrayPasteMode>>(new Map());

  // Build the field tree
  const fieldTree = useMemo(() => {
    return buildFieldTree(sourceSchema, sourceData);
  }, [sourceSchema, sourceData]);

  // Reset selection when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedPaths(new Set());
      setArrayModes(new Map());
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

  const handleArrayModeChange = useCallback((path: string, mode: ArrayPasteMode) => {
    setArrayModes((prev) => {
      const next = new Map(prev);
      next.set(path, mode);
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
    // Get all array paths to check which selected paths are arrays
    const allArrayPaths = new Set(getAllArrayPaths(fieldTree));
    
    // Build selections with array modes
    const selections: PasteFieldSelection[] = Array.from(selectedPaths).map(path => {
      if (allArrayPaths.has(path)) {
        return {
          path,
          arrayMode: arrayModes.get(path) || 'overwrite',
        };
      }
      return { path };
    });
    
    onPaste(selections);
    onOpenChange(false);
  }, [selectedPaths, arrayModes, fieldTree, onPaste, onOpenChange]);

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
                  arrayModes={arrayModes}
                  onToggleSelect={handleToggleSelect}
                  onToggleExpand={handleToggleExpand}
                  onArrayModeChange={handleArrayModeChange}
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

import React from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, List, Hash, ToggleLeft, Type, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/context/DataContext';
import type { SchemaField } from '@/types';

interface TreeNodeProps {
  name: string;
  path: string;
  schema: SchemaField;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  showTypes: boolean;
  hideSimpleFields?: boolean;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  // Pass these through for children
  selectedPath: string | null;
  expandedPaths: Set<string>;
  // Error count for this node and its children
  errorCount?: number;
  getErrorCountForPath: (path: string) => number;
  // Is this the root node?
  isRoot?: boolean;
}

interface ConnectedTreeNodeProps {
  name: string;
  path: string;
  schema: SchemaField;
  depth: number;
  showTypes: boolean;
  hideSimpleFields?: boolean;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  getErrorCountForPath: (path: string) => number;
  // Is this the root node?
  isRoot?: boolean;
}

// Helper to get value at a path that may include array indices
// e.g., "users[0].address" or "items[1][2].name"
function getValueAtPath(data: unknown, path: string): unknown {
  if (!path || !data) return data;
  
  // Parse the path, handling both dot notation and array index notation
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

// Get the label for an array item based on its value
function getArrayItemLabel(item: unknown, index: number): string {
  if (item === null || item === undefined) {
    return `Item ${index + 1}`;
  }
  
  if (typeof item === 'object' && !Array.isArray(item)) {
    // For objects, try to find a name/title/label field
    const obj = item as Record<string, unknown>;
    const nameField = obj.name || obj.title || obj.label || obj.id;
    if (nameField && typeof nameField === 'string') {
      return nameField;
    }
    // Use first string field value
    for (const value of Object.values(obj)) {
      if (typeof value === 'string' && value.length > 0 && value.length < 50) {
        return value;
      }
    }
    return `Item ${index + 1}`;
  }
  
  // For primitives, show the value
  const str = String(item);
  if (str.length > 30) {
    return str.substring(0, 27) + '...';
  }
  return str;
}

function getTypeIcon(type: string, isExpanded: boolean) {
  switch (type) {
    case 'object':
      return isExpanded ? (
        <FolderOpen className="h-4 w-4 text-blue-500" />
      ) : (
        <Folder className="h-4 w-4 text-blue-500" />
      );
    case 'array':
      return <List className="h-4 w-4 text-green-500" />;
    case 'string':
      return <Type className="h-4 w-4 text-orange-500" />;
    case 'integer':
    case 'number':
      return <Hash className="h-4 w-4 text-purple-500" />;
    case 'boolean':
      return <ToggleLeft className="h-4 w-4 text-pink-500" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

function getTypeBadgeVariant(type: string): 'default' | 'secondary' | 'outline' {
  switch (type) {
    case 'object':
    case 'array':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function TreeNode({
  name,
  path,
  schema,
  depth,
  isSelected,
  isExpanded,
  showTypes,
  hideSimpleFields = false,
  onSelect,
  onToggle,
  selectedPath,
  expandedPaths,
  errorCount = 0,
  getErrorCountForPath,
  isRoot = false,
}: TreeNodeProps) {
  const { data } = useData();
  const isExpandable = schema.type === 'object' || schema.type === 'array';
  const isArray = schema.type === 'array';

  // Get array data for this path if it's an array
  const arrayData = React.useMemo(() => {
    if (!isArray) return undefined;
    return getValueAtPath(data, path);
  }, [isArray, data, path]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(path);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExpandable) {
      onToggle(path);
    }
  };

  const getChildren = (): [string, SchemaField][] => {
    if (schema.type === 'object' && schema.fields) {
      return Object.entries(schema.fields).filter(
        ([, field]) => {
          // Always filter out hidden fields
          if (field.ui_config?.hidden) return false;
          // Filter out simple fields if hideSimpleFields is enabled
          if (hideSimpleFields && field.type !== 'object' && field.type !== 'array') {
            return false;
          }
          return true;
        }
      );
    }
    // For arrays, we don't return schema children here anymore
    // Array items will be rendered separately
    return [];
  };

  const children = getChildren();
  const hasChildren = children.length > 0 || (isArray && Array.isArray(arrayData) && arrayData.length > 0);

  const nodeContent = (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-md text-sm',
        'hover:bg-accent hover:text-accent-foreground',
        'transition-colors duration-150',
        isSelected && 'bg-accent text-accent-foreground font-medium',
        errorCount > 0 && 'text-destructive'
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={handleClick}
    >
      {isExpandable && hasChildren ? (
        <button
          onClick={handleToggle}
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
      <span className="shrink-0">{getTypeIcon(schema.type, isExpanded)}</span>
      <span className="truncate flex-1">{schema.ui_config?.label || schema.title || name}</span>
      {errorCount > 0 && (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 shrink-0 flex items-center gap-0.5">
          <AlertCircle className="h-3 w-3" />
          {errorCount}
        </Badge>
      )}
      {showTypes && (
        <Badge variant={getTypeBadgeVariant(schema.type)} className="text-[10px] px-1.5 py-0 h-5 shrink-0">
          {schema.type}
        </Badge>
      )}
      {schema.required === false && (
        <span className="text-[10px] text-muted-foreground shrink-0">optional</span>
      )}
    </div>
  );

  if (!isExpandable || !hasChildren) {
    return nodeContent;
  }

  // For root node, only render the toggle-able content without nested children
  // (children are rendered separately in TreePanel/index.tsx)
  if (isRoot) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-md text-sm',
          'hover:bg-accent hover:text-accent-foreground',
          'transition-colors duration-150',
          isSelected && 'bg-accent text-accent-foreground font-medium',
          errorCount > 0 && 'text-destructive'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        <button
          onClick={handleToggle}
          className="p-0.5 hover:bg-muted rounded shrink-0"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <span className="shrink-0">{getTypeIcon(schema.type, isExpanded)}</span>
        <span className="truncate flex-1">{schema.ui_config?.label || schema.title || name}</span>
        {errorCount > 0 && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 shrink-0 flex items-center gap-0.5">
            <AlertCircle className="h-3 w-3" />
            {errorCount}
          </Badge>
        )}
        {showTypes && (
          <Badge variant={getTypeBadgeVariant(schema.type)} className="text-[10px] px-1.5 py-0 h-5 shrink-0">
            {schema.type}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={() => onToggle(path)}>
      <CollapsibleTrigger asChild>{nodeContent}</CollapsibleTrigger>
      <CollapsibleContent>
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 w-px bg-border"
            style={{ left: `${depth * 16 + 18}px` }}
          />
          {/* Render object children */}
          {children.map(([childName, childSchema]) => {
            const childPath = `${path}.${childName}`;
            const childErrorCount = getErrorCountForPath(childPath);
            return (
              <TreeNode
                key={childPath}
                name={childName}
                path={childPath}
                schema={childSchema}
                depth={depth + 1}
                isSelected={selectedPath === childPath}
                isExpanded={expandedPaths.has(childPath)}
                showTypes={showTypes}
                hideSimpleFields={hideSimpleFields}
                onSelect={onSelect}
                onToggle={onToggle}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                errorCount={childErrorCount}
                getErrorCountForPath={getErrorCountForPath}
              />
            );
          })}
          {/* Render array items as sub-nodes */}
          {isArray && Array.isArray(arrayData) && arrayData.map((item, index) => {
            const itemPath = `${path}[${index}]`;
            const itemLabel = getArrayItemLabel(item, index);
            const itemSchema = schema.items || { type: 'object' };
            const itemErrorCount = getErrorCountForPath(itemPath);
            
            // Check if this array item has nested content (object or array)
            const itemIsExpandable = itemSchema.type === 'object' || itemSchema.type === 'array';
            
            if (itemIsExpandable && itemSchema.type === 'object' && itemSchema.fields) {
              // Render as expandable node for objects
              return (
                <TreeNode
                  key={itemPath}
                  name={itemLabel}
                  path={itemPath}
                  schema={itemSchema}
                  depth={depth + 1}
                  isSelected={selectedPath === itemPath}
                  isExpanded={expandedPaths.has(itemPath)}
                  showTypes={showTypes}
                  hideSimpleFields={hideSimpleFields}
                  onSelect={onSelect}
                  onToggle={onToggle}
                  selectedPath={selectedPath}
                  expandedPaths={expandedPaths}
                  errorCount={itemErrorCount}
                  getErrorCountForPath={getErrorCountForPath}
                />
              );
            }
            
            // Skip primitive array items when hideSimpleFields is enabled
            if (hideSimpleFields && !itemIsExpandable) {
              return null;
            }
            
            // Render as leaf node for primitives
            return (
              <ArrayItemNode
                key={itemPath}
                label={itemLabel}
                path={itemPath}
                depth={depth + 1}
                isSelected={selectedPath === itemPath}
                showTypes={showTypes}
                itemType={itemSchema.type}
                onSelect={onSelect}
                errorCount={itemErrorCount}
              />
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Simple leaf node for array items (primitives)
interface ArrayItemNodeProps {
  label: string;
  path: string;
  depth: number;
  isSelected: boolean;
  showTypes: boolean;
  itemType: string;
  onSelect: (path: string) => void;
  errorCount?: number;
}

function ArrayItemNode({
  label,
  path,
  depth,
  isSelected,
  showTypes,
  itemType,
  onSelect,
  errorCount = 0,
}: ArrayItemNodeProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(path);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-md text-sm',
        'hover:bg-accent hover:text-accent-foreground',
        'transition-colors duration-150',
        isSelected && 'bg-accent text-accent-foreground font-medium',
        errorCount > 0 && 'text-destructive'
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={handleClick}
    >
      <span className="w-5 shrink-0" />
      <span className="shrink-0">{getTypeIcon(itemType, false)}</span>
      <span className="truncate flex-1">{label}</span>
      {errorCount > 0 && (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 shrink-0 flex items-center gap-0.5">
          <AlertCircle className="h-3 w-3" />
          {errorCount}
        </Badge>
      )}
      {showTypes && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
          {itemType}
        </Badge>
      )}
    </div>
  );
}

// A wrapper that computes isSelected and isExpanded from the context props
export function ConnectedTreeNode({
  name,
  path,
  schema,
  depth,
  showTypes,
  hideSimpleFields = false,
  selectedPath,
  expandedPaths,
  onSelect,
  onToggle,
  getErrorCountForPath,
  isRoot = false,
}: ConnectedTreeNodeProps) {
  const errorCount = getErrorCountForPath(path);
  
  return (
    <TreeNode
      name={name}
      path={path}
      schema={schema}
      depth={depth}
      isSelected={selectedPath === path}
      isExpanded={expandedPaths.has(path)}
      showTypes={showTypes}
      hideSimpleFields={hideSimpleFields}
      onSelect={onSelect}
      onToggle={onToggle}
      selectedPath={selectedPath}
      expandedPaths={expandedPaths}
      errorCount={errorCount}
      getErrorCountForPath={getErrorCountForPath}
      isRoot={isRoot}
    />
  );
}

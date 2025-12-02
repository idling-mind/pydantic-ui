import React from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, List, Hash, ToggleLeft, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import type { SchemaField } from '@/types';

interface TreeNodeProps {
  name: string;
  path: string;
  schema: SchemaField;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  showTypes: boolean;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  // Pass these through for children
  selectedPath: string | null;
  expandedPaths: Set<string>;
}

interface ConnectedTreeNodeProps {
  name: string;
  path: string;
  schema: SchemaField;
  depth: number;
  showTypes: boolean;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
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
  onSelect,
  onToggle,
  selectedPath,
  expandedPaths,
}: TreeNodeProps) {
  const isExpandable = schema.type === 'object' || schema.type === 'array';

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
        ([, field]) => !field.ui_config?.hidden
      );
    }
    if (schema.type === 'array' && schema.items) {
      // For arrays, we show the item type structure
      if (schema.items.type === 'object' && schema.items.fields) {
        return Object.entries(schema.items.fields).filter(
          ([, field]) => !field.ui_config?.hidden
        );
      }
    }
    return [];
  };

  const children = getChildren();
  const hasChildren = children.length > 0;

  const nodeContent = (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-md text-sm',
        'hover:bg-accent hover:text-accent-foreground',
        'transition-colors duration-150',
        isSelected && 'bg-accent text-accent-foreground font-medium'
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

  return (
    <Collapsible open={isExpanded} onOpenChange={() => onToggle(path)}>
      <CollapsibleTrigger asChild>{nodeContent}</CollapsibleTrigger>
      <CollapsibleContent>
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 w-px bg-border"
            style={{ left: `${depth * 16 + 18}px` }}
          />
          {children.map(([childName, childSchema]) => {
            const childPath = `${path}.${childName}`;
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
                onSelect={onSelect}
                onToggle={onToggle}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
              />
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// A wrapper that computes isSelected and isExpanded from the context props
export function ConnectedTreeNode({
  name,
  path,
  schema,
  depth,
  showTypes,
  selectedPath,
  expandedPaths,
  onSelect,
  onToggle,
}: ConnectedTreeNodeProps) {
  return (
    <TreeNode
      name={name}
      path={path}
      schema={schema}
      depth={depth}
      isSelected={selectedPath === path}
      isExpanded={expandedPaths.has(path)}
      showTypes={showTypes}
      onSelect={onSelect}
      onToggle={onToggle}
      selectedPath={selectedPath}
      expandedPaths={expandedPaths}
    />
  );
}

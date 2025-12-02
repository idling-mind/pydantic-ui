import React from 'react';
import { Search, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useData } from '@/context/DataContext';
import { TreeNode, ConnectedTreeNode } from './TreeNode';
import type { SchemaField } from '@/types';

interface TreePanelProps {
  className?: string;
}

export function TreePanel({ className }: TreePanelProps) {
  const {
    schema,
    selectedPath,
    expandedPaths,
    setSelectedPath,
    toggleExpanded,
    getErrorCountForPath,
  } = useData();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [showTypes, setShowTypes] = React.useState(true);

  const handleSelect = React.useCallback(
    (path: string) => {
      setSelectedPath(path);
      // Auto-expand parent paths
      const parts = path.split('.');
      for (let i = 1; i < parts.length; i++) {
        const parentPath = parts.slice(0, i).join('.');
        if (!expandedPaths.has(parentPath)) {
          toggleExpanded(parentPath);
        }
      }
    },
    [setSelectedPath, expandedPaths, toggleExpanded]
  );

  const handleToggle = React.useCallback(
    (path: string) => {
      toggleExpanded(path);
    },
    [toggleExpanded]
  );

  // Filter function for search
  const filterSchema = React.useCallback(
    (field: SchemaField, name: string): boolean => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      
      // Check name, title, description
      if (name.toLowerCase().includes(query)) return true;
      if (field.title?.toLowerCase().includes(query)) return true;
      if (field.description?.toLowerCase().includes(query)) return true;
      if (field.ui_config?.label?.toLowerCase().includes(query)) return true;
      
      // Check children
      if (field.type === 'object' && field.fields) {
        return Object.entries(field.fields).some(([childName, childField]) =>
          filterSchema(childField, childName)
        );
      }
      if (field.type === 'array' && field.items?.fields) {
        return Object.entries(field.items.fields).some(([childName, childField]) =>
          filterSchema(childField, childName)
        );
      }
      
      return false;
    },
    [searchQuery]
  );

  if (!schema) {
    return (
      <div className={cn('flex items-center justify-center h-full text-muted-foreground', className)}>
        Loading schema...
      </div>
    );
  }

  const rootFields = schema.type === 'object' && schema.fields
    ? Object.entries(schema.fields).filter(
        ([name, field]) => !field.ui_config?.hidden && filterSchema(field, name)
      )
    : [];

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center gap-2 text-sm font-medium mb-2">
          <ChevronRight className="h-4 w-4" />
          <span>{schema.title || 'Schema'}</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-3 py-2 flex items-center justify-between border-b">
        <span className="text-xs text-muted-foreground">
          {rootFields.length} field{rootFields.length !== 1 ? 's' : ''}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTypes(!showTypes)}
          className="h-7 px-2 text-xs"
        >
          {showTypes ? (
            <>
              <EyeOff className="h-3 w-3 mr-1" /> Hide types
            </>
          ) : (
            <>
              <Eye className="h-3 w-3 mr-1" /> Show types
            </>
          )}
        </Button>
      </div>

      <Separator />

      {/* Tree Content */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {rootFields.length === 0 && !searchQuery ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No fields available
            </div>
          ) : (
            <>
              {/* Root object node */}
              <ConnectedTreeNode
                key="__root__"
                name={schema.title || schema.name || 'Root'}
                path=""
                schema={schema}
                depth={0}
                showTypes={showTypes}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                onSelect={handleSelect}
                onToggle={handleToggle}
                getErrorCountForPath={getErrorCountForPath}
                isRoot
              />
              {/* Child fields when root is expanded */}
              {expandedPaths.has('') && rootFields.map(([name, field]) => (
                <ConnectedTreeNode
                  key={name}
                  name={name}
                  path={name}
                  schema={field}
                  depth={1}
                  showTypes={showTypes}
                  selectedPath={selectedPath}
                  expandedPaths={expandedPaths}
                  onSelect={handleSelect}
                  onToggle={handleToggle}
                  getErrorCountForPath={getErrorCountForPath}
                />
              ))}
              {searchQuery && rootFields.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No fields match your search
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export { TreeNode, ConnectedTreeNode };

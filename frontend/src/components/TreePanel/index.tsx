import React from 'react';
import { Search, Eye, EyeOff, Filter, FilterX, ChevronsDown, ChevronsUp, ArrowUp, X } from 'lucide-react';
import { cn, isFieldVisible } from '@/lib/utils';
import { resolveDisplay } from '@/lib/displayUtils';
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
    data,
    selectedPath,
    expandedPaths,
    setSelectedPath,
    toggleExpanded,
    getErrorCountForPath,
    updateValue,
    expandAll,
    collapseAll,
  } = useData();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [showTypes, setShowTypes] = React.useState(true);
  const [hideSimpleFields, setHideSimpleFields] = React.useState(false);
  const [multiSelectedPaths, setMultiSelectedPaths] = React.useState<Set<string>>(new Set());

  const handleSelect = React.useCallback(
    (path: string) => {
      setSelectedPath(path);
      // Clear multi-select when doing single select
      setMultiSelectedPaths(new Set());
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

  const handleMultiSelect = React.useCallback(
    (path: string, additive: boolean) => {
      setMultiSelectedPaths((prev) => {
        const next = new Set(prev);
        if (additive) {
          if (next.has(path)) {
            next.delete(path);
          } else {
            next.add(path);
          }
        } else {
          next.clear();
          next.add(path);
        }
        return next;
      });
    },
    []
  );

  const handleMultiPaste = React.useCallback(
    (paths: string[], data: unknown) => {
      for (const targetPath of paths) {
        if (targetPath === '') {
          // Pasting to root - merge the data
          const merged = data as Record<string, unknown>;
          for (const key of Object.keys(merged)) {
            updateValue(key, merged[key]);
          }
        } else {
          updateValue(targetPath, data);
        }
      }
    },
    [updateValue]
  );

  const handleToggle = React.useCallback(
    (path: string) => {
      toggleExpanded(path);
    },
    [toggleExpanded]
  );

  const handleUpOneLevel = React.useCallback(() => {
    if (!selectedPath) return;
    
    // Parse path to find parent
    let parentPath = '';
    if (selectedPath.endsWith(']')) {
      // Remove [index]
      const lastBracket = selectedPath.lastIndexOf('[');
      if (lastBracket !== -1) {
        parentPath = selectedPath.substring(0, lastBracket);
      }
    } else {
      // Remove .name
      const lastDot = selectedPath.lastIndexOf('.');
      if (lastDot !== -1) {
        parentPath = selectedPath.substring(0, lastDot);
      } else {
        // No dot, so it's a top level property. Parent is root.
        parentPath = '';
      }
    }
    
    setSelectedPath(parentPath);
  }, [selectedPath, setSelectedPath]);

  // Check if a field is a simple (primitive) field
  const isSimpleField = React.useCallback((field: SchemaField): boolean => {
    // Objects, arrays, and unions with expandable variants are complex
    if (field.type === 'object' || field.type === 'array') {
      return false;
    }
    // Unions are complex if they have variants that are objects or arrays
    if (field.type === 'union' && field.variants) {
      return !field.variants.some(v => v.type === 'object' || v.type === 'array');
    }
    // Everything else (string, number, boolean, etc.) is simple
    return true;
  }, []);

  // Helper to get value at a path
  const getValueAtPath = React.useCallback((data: unknown, path: string): unknown => {
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
  }, []);

  // Build a map of paths to their rendered titles and check for matches
  const buildSearchIndex = React.useCallback(
    (field: SchemaField, name: string, path: string, matches: Set<string>): void => {
      const query = searchQuery.toLowerCase();
      if (!query) return;

      // Get the value at this path
      const fieldValue = getValueAtPath(data, path);

      // Get the rendered title for this node
      const display = resolveDisplay({ 
        schema: field, 
        view: 'tree', 
        name,
        data: fieldValue 
      });
      
      // Check if this node matches
      const titleMatches = display.title.toLowerCase().includes(query);
      const descMatches = field.description?.toLowerCase().includes(query);
      const helpMatches = display.helpText?.toLowerCase().includes(query);
      
      if (titleMatches || descMatches || helpMatches) {
        matches.add(path);
      }

      // Recursively check children
      if (field.type === 'object' && field.fields) {
        Object.entries(field.fields).forEach(([childName, childField]) => {
          const childPath = path ? `${path}.${childName}` : childName;
          buildSearchIndex(childField, childName, childPath, matches);
        });
      }

      // Check array items
      if (field.type === 'array' && Array.isArray(fieldValue)) {
        fieldValue.forEach((item, index) => {
          const itemPath = `${path}[${index}]`;
          
          // Check the array item's title
          if (field.items) {
            const itemDisplay = resolveDisplay({
              schema: field.items,
              view: 'tree',
              name: `Item ${index + 1}`,
              data: item
            });
            
            if (itemDisplay.title.toLowerCase().includes(query)) {
              matches.add(itemPath);
            }
            
            // Check nested fields in object items
            if (field.items.type === 'object' && field.items.fields) {
              Object.entries(field.items.fields).forEach(([childName, childField]) => {
                const childPath = `${itemPath}.${childName}`;
                buildSearchIndex(childField, childName, childPath, matches);
              });
            }
          }
        });
      }

      // Check union variants
      if (field.type === 'union' && field.variants) {
        field.variants.forEach(variant => {
          if (variant.variant_name?.toLowerCase().includes(query)) {
            matches.add(path);
          }
          if (variant.type === 'object' && variant.fields) {
            Object.entries(variant.fields).forEach(([childName, childField]) => {
              const childPath = path ? `${path}.${childName}` : childName;
              buildSearchIndex(childField, childName, childPath, matches);
            });
          }
        });
      }
    },
    [searchQuery, data, getValueAtPath]
  );

  // Get all paths that match the search, including parent paths
  const { matchedPaths, directMatches } = React.useMemo(() => {
    const directMatches = new Set<string>();
    const matches = new Set<string>();
    
    if (!searchQuery || !schema || schema.type !== 'object' || !schema.fields) {
      return { matchedPaths: matches, directMatches };
    }

    // Build index of all matching paths (direct matches only)
    Object.entries(schema.fields).forEach(([name, field]) => {
      buildSearchIndex(field, name, name, directMatches);
    });

    // Add all parent paths of matched paths
    directMatches.forEach(path => {
      matches.add(path);
      
      // Add all parent paths
      const parts = path.split(/[\.\[]/).filter(p => p && p !== ']');
      for (let i = 1; i < parts.length; i++) {
        // Reconstruct path up to this point
        let parentPath = '';
        for (let j = 0; j < i; j++) {
          if (j > 0) {
            // Check if next part is a number (array index)
            if (/^\d+$/.test(parts[j])) {
              parentPath += `[${parts[j]}]`;
            } else {
              parentPath += `.${parts[j]}`;
            }
          } else {
            parentPath = parts[j];
          }
        }
        if (parentPath) {
          matches.add(parentPath);
        }
      }
    });

    return { matchedPaths: matches, directMatches };
  }, [searchQuery, schema, buildSearchIndex]);

  // Auto-expand parents of matched paths when searching
  React.useEffect(() => {
    if (searchQuery && matchedPaths.size > 0) {
      // Expand all parent paths of matched items
      matchedPaths.forEach(path => {
        if (!directMatches.has(path)) {
          // This is a parent path, expand it
          if (!expandedPaths.has(path)) {
            toggleExpanded(path);
          }
        } else {
          // This is a direct match, expand its parents
          const parts = path.split(/[\.\[]/).filter(p => p && p !== ']');
          for (let i = 1; i < parts.length; i++) {
            let parentPath = '';
            for (let j = 0; j < i; j++) {
              if (j > 0) {
                if (/^\d+$/.test(parts[j])) {
                  parentPath += `[${parts[j]}]`;
                } else {
                  parentPath += `.${parts[j]}`;
                }
              } else {
                parentPath = parts[j];
              }
            }
            if (parentPath && !expandedPaths.has(parentPath)) {
              toggleExpanded(parentPath);
            }
          }
        }
      });
    }
  }, [searchQuery, matchedPaths, directMatches]);

  // Filter function for visibility and simple fields
  const shouldShowField = React.useCallback(
    (field: SchemaField, _name: string, path: string): boolean => {
      // First check if we should hide simple fields
      if (hideSimpleFields && isSimpleField(field)) {
        return false;
      }

      // Check visibility based on hidden and visible_when conditions
      const fieldValue = getValueAtPath(data, path);
      if (!isFieldVisible(field, data || {}, fieldValue)) {
        return false;
      }

      // Filter out optional fields that are not initialized (null/undefined)
      if (field.required === false && !field.ui_config?.visible_when) {
        if (fieldValue === null || fieldValue === undefined) {
          return false;
        }
      }

      // If we have a search query, only show fields in matched paths
      // This includes both direct matches and their parent paths
      if (searchQuery && matchedPaths.size > 0) {
        return matchedPaths.has(path);
      }

      return true;
    },
    [hideSimpleFields, isSimpleField, data, searchQuery, matchedPaths, getValueAtPath]
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
        ([name, field]) => shouldShowField(field, name, name)
      )
    : [];

  return (
    <div className={cn('flex flex-col h-full', className)} data-pydantic-ui="tree-panel">
      {/* Header */}
      <div className="p-3 border-b" data-pydantic-ui="tree-search-container">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 h-9"
            data-pydantic-ui="tree-search"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-3 py-2 flex items-center justify-between border-b" data-pydantic-ui="tree-toolbar">
        <span className="text-xs text-muted-foreground">
          {rootFields.length} field{rootFields.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant={hideSimpleFields ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setHideSimpleFields(!hideSimpleFields)}
            className="h-7 px-2 text-xs"
            title={hideSimpleFields ? 'Show simple fields' : 'Hide simple fields'}
            data-pydantic-ui="tree-filter-simple"
          >
            {hideSimpleFields ? (
              <>
                <FilterX className="h-3 w-3 mr-1" /> Simple
              </>
            ) : (
              <>
                <Filter className="h-3 w-3 mr-1" /> Simple
              </>
            )}
          </Button>
          <Button
            variant={showTypes ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowTypes(!showTypes)}
            className="h-7 px-2 text-xs"
            title={showTypes ? 'Hide type badges' : 'Show type badges'}
            data-pydantic-ui="tree-toggle-types"
          >
            {showTypes ? (
              <>
                <Eye className="h-3 w-3 mr-1" /> Types
              </>
            ) : (
              <>
                <EyeOff className="h-3 w-3 mr-1" /> Types
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tree Actions */}
      <div className="px-3 py-2 flex items-center gap-1 border-b bg-muted/20" data-pydantic-ui="tree-actions">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={expandAll} 
          title="Expand All"
          className="h-7 px-2 text-xs"
          data-pydantic-ui="tree-expand-all"
        >
          <ChevronsDown className="h-3.5 w-3.5 mr-1" />
          Expand All
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={collapseAll} 
          title="Collapse All"
          className="h-7 px-2 text-xs"
          data-pydantic-ui="tree-collapse-all"
        >
          <ChevronsUp className="h-3.5 w-3.5 mr-1" />
          Collapse All
        </Button>
        <div className="flex-1" />
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleUpOneLevel} 
          disabled={!selectedPath || selectedPath === ''}
          title="Up One Level"
          className="h-7 px-2 text-xs"
          data-pydantic-ui="tree-up-level"
        >
          <ArrowUp className="h-3.5 w-3.5 mr-1" />
          Up Level
        </Button>
      </div>

      <Separator />

      {/* Tree Content */}
      <ScrollArea className="flex-1">
        <div className="py-2" data-pydantic-ui="tree-content">
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
                hideSimpleFields={hideSimpleFields}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                onSelect={handleSelect}
                onToggle={handleToggle}
                getErrorCountForPath={getErrorCountForPath}
                isRoot
                multiSelectedPaths={multiSelectedPaths}
                onMultiSelect={handleMultiSelect}
                onMultiPaste={handleMultiPaste}
                matchedPaths={matchedPaths}
                searchQuery={searchQuery}
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
                  hideSimpleFields={hideSimpleFields}
                  selectedPath={selectedPath}
                  expandedPaths={expandedPaths}
                  onSelect={handleSelect}
                  onToggle={handleToggle}
                  getErrorCountForPath={getErrorCountForPath}
                  multiSelectedPaths={multiSelectedPaths}
                  onMultiSelect={handleMultiSelect}
                  onMultiPaste={handleMultiPaste}
                  matchedPaths={matchedPaths}
                  searchQuery={searchQuery}
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

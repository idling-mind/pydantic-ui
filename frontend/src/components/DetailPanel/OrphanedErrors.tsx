import React from 'react';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FieldError, SchemaField } from '@/types';

const DEFAULT_MAX_VISIBLE_ERRORS = 5;

interface OrphanedErrorsProps {
  errors: FieldError[];
  basePath: string;
  schema: SchemaField;
  className?: string;
  maxVisibleErrors?: number;
}

interface PathPart {
  key: string;
  isIndex: boolean;
}

function getRelativePath(errorPath: string, basePath: string): string | null {
  if (!basePath) {
    return errorPath;
  }

  if (errorPath === basePath) {
    return '';
  }

  if (errorPath.startsWith(basePath + '.')) {
    return errorPath.slice(basePath.length + 1);
  }

  if (errorPath.startsWith(basePath + '[')) {
    return errorPath.slice(basePath.length);
  }

  return null;
}

function parsePath(path: string): PathPart[] {
  const pathRegex = /([^.\[\]]+)|\[(\d+)\]/g;
  const parts: PathPart[] = [];
  let match;

  while ((match = pathRegex.exec(path)) !== null) {
    if (match[1] !== undefined) {
      parts.push({ key: match[1], isIndex: false });
    } else if (match[2] !== undefined) {
      parts.push({ key: match[2], isIndex: true });
    }
  }

  return parts;
}

function getDeepestResolvablePath(errorPath: string, basePath: string, schema: SchemaField): string | null {
  const normalizedBasePath = basePath === 'root' ? '' : basePath;

  if (!errorPath || errorPath === '__root__' || errorPath.startsWith('__')) {
    return null;
  }

  const relativePath = getRelativePath(errorPath, normalizedBasePath);
  if (relativePath === null) {
    return null;
  }

  if (relativePath === '') {
    return normalizedBasePath;
  }

  const parts = parsePath(relativePath);
  let currentSchema: SchemaField | undefined = schema;
  let currentPath = normalizedBasePath;

  for (const part of parts) {
    if (!currentSchema) {
      break;
    }

    if (part.isIndex) {
      if (currentSchema.type === 'array' && currentSchema.items) {
        currentSchema = currentSchema.items;
      } else if (currentSchema.type === 'union' && currentSchema.variants) {
        const arrayVariantWithItems: SchemaField | undefined = currentSchema.variants.find(
          (variant) => variant.type === 'array' && variant.items
        )?.items;
        if (!arrayVariantWithItems) {
          break;
        }
        currentSchema = arrayVariantWithItems;
      } else {
        break;
      }

      currentPath = currentPath ? `${currentPath}[${part.key}]` : `[${part.key}]`;
      continue;
    }

    if (currentSchema.type === 'object' && currentSchema.fields?.[part.key]) {
      currentSchema = currentSchema.fields[part.key];
      currentPath = currentPath ? `${currentPath}.${part.key}` : part.key;
      continue;
    }

    if (currentSchema.type === 'union' && currentSchema.variants) {
      const fieldFromVariant: SchemaField | undefined = currentSchema.variants.find(
        (variant) => variant.type === 'object' && variant.fields?.[part.key]
      )?.fields?.[part.key];

      if (!fieldFromVariant) {
        break;
      }

      currentSchema = fieldFromVariant;
      currentPath = currentPath ? `${currentPath}.${part.key}` : part.key;
      continue;
    }

    break;
  }

  return currentPath;
}

/**
 * Get errors that should be displayed at the current level.
 * These include:
 * 1. Errors for the exact basePath (root-level errors for current object)
 * 2. Errors with special root paths like "__root__" when at root level
 * 3. Errors for child paths that cannot be navigated to (orphaned errors)
 */
export function getOrphanedErrors(
  errors: FieldError[],
  basePath: string,
  schema: SchemaField
): FieldError[] {
  if (!errors || errors.length === 0) return [];

  const normalizedBasePath = basePath === 'root' ? '' : basePath;

  return errors.filter((error) => {
    // Handle root-level model validation errors
    // These can have paths like "", "__root__", or other special Pydantic paths
    if (normalizedBasePath === '') {
      // At root level, include errors with empty path or special root markers
      if (error.path === '' || error.path === '__root__' || error.path.startsWith('__')) {
        return true;
      }
    }

    // Show this error only at the deepest level that can still be resolved.
    // This prevents bubbling orphaned errors to all ancestor levels.
    const deepestResolvablePath = getDeepestResolvablePath(error.path, normalizedBasePath, schema);
    if (deepestResolvablePath === null) {
      return false;
    }

    return deepestResolvablePath === normalizedBasePath;
  });
}

/**
 * Format the error path for display, making it relative to the current view
 */
function formatErrorPath(errorPath: string, basePath: string): string {
  const normalizedBasePath = basePath === 'root' ? '' : basePath;
  
  // Handle special root-level paths
  if (errorPath === '' || errorPath === '__root__') {
    return '(model validation)';
  }
  
  if (errorPath.startsWith('__')) {
    return errorPath; // Show the raw path for special validators
  }
  
  if (!normalizedBasePath || errorPath === normalizedBasePath) {
    return errorPath || '(root)';
  }

  if (errorPath.startsWith(normalizedBasePath + '.')) {
    return errorPath.slice(normalizedBasePath.length + 1);
  }

  if (errorPath.startsWith(normalizedBasePath + '[')) {
    return errorPath.slice(normalizedBasePath.length);
  }

  return errorPath;
}

/**
 * Component to display validation errors that should be shown at the current level.
 * This includes:
 * - Errors for the current path itself
 * - Errors for child paths that don't exist in the schema (orphaned)
 * 
 * If there are more than 5 errors, displays only the first 5 with an
 * expandable "Show more" button.
 */
export function OrphanedErrors({
  errors,
  basePath,
  schema,
  className,
  maxVisibleErrors,
}: OrphanedErrorsProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const orphanedErrors = getOrphanedErrors(errors, basePath, schema);
  const maxVisible = maxVisibleErrors ?? DEFAULT_MAX_VISIBLE_ERRORS;

  if (orphanedErrors.length === 0) {
    return null;
  }

  const hasMoreErrors = orphanedErrors.length > maxVisible;
  const visibleErrors = isExpanded ? orphanedErrors : orphanedErrors.slice(0, maxVisible);
  const hiddenCount = orphanedErrors.length - maxVisible;

  return (
    <div className={cn('space-y-2', className)}>
      {visibleErrors.map((error, index) => {
        const displayPath = formatErrorPath(error.path, basePath);

        return (
          <Card
            key={`${error.path}-${index}`}
            className="border-destructive bg-destructive/5"
          >
            <CardContent className="flex items-start gap-3 p-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-destructive font-medium">
                  {error.message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="mr-1">Path:</span>
                  <span className="font-mono">{displayPath}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {hasMoreErrors && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground hover:text-foreground"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-2" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-2" />
              Show {hiddenCount} more error{hiddenCount !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      )}
    </div>
  );
}

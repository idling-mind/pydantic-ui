import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { FieldError, SchemaField } from '@/types';

interface OrphanedErrorsProps {
  errors: FieldError[];
  basePath: string;
  schema: SchemaField;
  className?: string;
}

/**
 * Check if a path can be navigated to in the schema from the basePath.
 * Returns true if the path leads to a valid, navigable schema location.
 * A path is "navigable" if:
 * - It exists in the schema AND
 * - It leads to an object or array that the user can click into
 */
function isPathNavigable(errorPath: string, basePath: string, schema: SchemaField): boolean {
  const normalizedBasePath = basePath === 'root' ? '' : basePath;
  
  // If error path equals basePath, it's for the current object itself - not navigable further
  if (errorPath === normalizedBasePath) {
    return false;
  }

  // Get the relative path from basePath
  let relativePath = errorPath;
  if (normalizedBasePath) {
    if (errorPath.startsWith(normalizedBasePath + '.')) {
      relativePath = errorPath.slice(normalizedBasePath.length + 1);
    } else if (errorPath.startsWith(normalizedBasePath + '[')) {
      relativePath = errorPath.slice(normalizedBasePath.length);
    } else {
      // Error is not under basePath
      return false;
    }
  }

  if (!relativePath) {
    return false;
  }

  // Parse the relative path and traverse the schema
  const pathRegex = /([^.\[\]]+)|\[(\d+)\]/g;
  const parts: { key: string; isIndex: boolean }[] = [];
  let match;
  while ((match = pathRegex.exec(relativePath)) !== null) {
    if (match[1] !== undefined) {
      parts.push({ key: match[1], isIndex: false });
    } else if (match[2] !== undefined) {
      parts.push({ key: match[2], isIndex: true });
    }
  }

  let currentSchema: SchemaField | undefined = schema;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!currentSchema) return false;

    if (part.isIndex) {
      // Array index access
      if (currentSchema.type === 'array' && currentSchema.items) {
        currentSchema = currentSchema.items;
      } else {
        return false;
      }
    } else {
      // Object field access
      if (currentSchema.type === 'object' && currentSchema.fields) {
        currentSchema = currentSchema.fields[part.key];
        if (!currentSchema) {
          return false;
        }
      } else {
        return false;
      }
    }
  }

  // Path exists - but is it navigable? 
  // Only objects and arrays with nested content can be "navigated" to
  if (currentSchema.type === 'object' && currentSchema.fields) {
    return true;
  }
  if (currentSchema.type === 'array' && currentSchema.items) {
    return true;
  }

  // Primitive fields are shown in the current view, so the error is "navigable"
  // in the sense that it's visible in the current context
  return true;
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

    // Include errors that match the exact current path
    if (error.path === normalizedBasePath) {
      return true;
    }

    // Check if error is under this basePath
    if (normalizedBasePath) {
      if (!error.path.startsWith(normalizedBasePath + '.') && 
          !error.path.startsWith(normalizedBasePath + '[')) {
        return false;
      }
    }

    // Include errors for paths that cannot be navigated to in the schema
    return !isPathNavigable(error.path, normalizedBasePath, schema);
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
 */
export function OrphanedErrors({ errors, basePath, schema, className }: OrphanedErrorsProps) {
  const orphanedErrors = getOrphanedErrors(errors, basePath, schema);

  if (orphanedErrors.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      {orphanedErrors.map((error, index) => (
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
              <p className="text-xs text-muted-foreground font-mono mt-1">
                Path: {formatErrorPath(error.path, basePath)}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

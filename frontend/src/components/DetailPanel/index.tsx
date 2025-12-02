import React from 'react';
import { Save, RotateCcw, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { ObjectEditor, ArrayEditor, ArrayListEditor } from './ObjectEditor';
import { FieldRenderer } from '@/components/Renderers';

interface DetailPanelProps {
  className?: string;
}

export function DetailPanel({ className }: DetailPanelProps) {
  const {
    schema,
    data,
    errors,
    loading,
    dirty,
    updateValue,
    saveData,
    resetData,
    selectedPath,
  } = useData();

  const [saving, setSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const success = await saveData();
      if (success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    resetData();
  };

  // Get the schema and value for the selected path
  const getSelectedSchema = () => {
    if (!schema || selectedPath === null) {
      return { selectedSchema: schema, selectedValue: data, basePath: '', isArrayItem: false, arrayPath: '', arrayIndex: -1 };
    }

    // Empty path means root selection
    if (selectedPath === '') {
      return { selectedSchema: schema, selectedValue: data, basePath: '', isArrayItem: false, arrayPath: '', arrayIndex: -1 };
    }

    // Parse the path, handling both dot notation and array index notation
    // e.g., "users[0].name" or "settings.items[2]"
    const pathRegex = /([^.\[\]]+)|\[(\d+)\]/g;
    const parts: { key: string; isIndex: boolean }[] = [];
    let match;
    while ((match = pathRegex.exec(selectedPath)) !== null) {
      if (match[1] !== undefined) {
        parts.push({ key: match[1], isIndex: false });
      } else if (match[2] !== undefined) {
        parts.push({ key: match[2], isIndex: true });
      }
    }

    let currentSchema = schema;
    let currentValue: unknown = data;
    let basePath = '';
    let isArrayItem = false;
    let arrayPath = '';
    let arrayIndex = -1;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!currentSchema) break;

      if (part.isIndex) {
        // Array index access
        const index = parseInt(part.key, 10);
        if (currentSchema.type === 'array' && currentSchema.items) {
          arrayPath = basePath;
          arrayIndex = index;
          isArrayItem = true;
          currentSchema = currentSchema.items;
          currentValue = (currentValue as unknown[])?.[index];
          basePath = basePath ? `${basePath}[${index}]` : `[${index}]`;
        } else {
          break;
        }
      } else if (currentSchema.type === 'object' && currentSchema.fields) {
        const fieldSchema = currentSchema.fields[part.key];
        if (fieldSchema) {
          currentSchema = fieldSchema;
          currentValue = (currentValue as Record<string, unknown>)?.[part.key];
          basePath = basePath ? `${basePath}.${part.key}` : part.key;
          // Reset array item tracking when we enter a new object
          if (!parts[i + 1]?.isIndex) {
            isArrayItem = false;
            arrayPath = '';
            arrayIndex = -1;
          }
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return { selectedSchema: currentSchema, selectedValue: currentValue, basePath, isArrayItem, arrayPath, arrayIndex };
  };

  const { selectedSchema, selectedValue, basePath } = getSelectedSchema();

  // Get errors for the current selection
  const getRelevantErrors = () => {
    if (!errors || !basePath) return errors;
    return errors.filter(
      (e) => e.path === basePath || e.path.startsWith(basePath + '.') || e.path.startsWith(basePath + '[')
    );
  };

  const relevantErrors = getRelevantErrors();

  const handleChange = (newValue: unknown) => {
    if (!basePath) {
      // Root level change - replace entire data
      if (typeof newValue === 'object' && newValue !== null) {
        Object.entries(newValue as Record<string, unknown>).forEach(([key, val]) => {
          updateValue(key, val);
        });
      }
    } else {
      updateValue(basePath, newValue);
    }
  };

  if (!schema) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading schema...</span>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (!selectedSchema) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Select a field from the tree to edit
        </div>
      );
    }

    // Handle different schema types
    if (selectedSchema.type === 'object' && selectedSchema.fields) {
      return (
        <ObjectEditor
          name={basePath || 'root'}
          path={basePath || 'root'}
          schema={selectedSchema}
          value={selectedValue as Record<string, unknown>}
          errors={relevantErrors}
          disabled={loading}
          onChange={handleChange}
        />
      );
    }

    if (selectedSchema.type === 'array') {
      // Show the array list view (summary with delete buttons)
      return (
        <ArrayListEditor
          name={basePath || 'root'}
          path={basePath || 'root'}
          schema={selectedSchema}
          value={selectedValue as unknown[]}
          errors={relevantErrors}
          disabled={loading}
          onChange={handleChange}
        />
      );
    }

    // Primitive type (could be an array item or a regular field)
    return (
      <FieldRenderer
        name={basePath || 'value'}
        path={basePath || 'value'}
        schema={selectedSchema}
        value={selectedValue}
        errors={relevantErrors}
        disabled={loading}
        onChange={handleChange}
      />
    );
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">
            {selectedSchema?.ui_config?.label || selectedSchema?.title || (basePath || 'Data Editor')}
          </h2>
          <div className="flex items-center gap-2">
            {errors && errors.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.length} error{errors.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {saveSuccess && (
              <Badge variant="default" className="gap-1 bg-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Saved
              </Badge>
            )}
          </div>
        </div>
        {selectedSchema?.description && !basePath && (
          <p className="text-sm text-muted-foreground">{selectedSchema.description}</p>
        )}
        {basePath && (
          <p className="text-xs text-muted-foreground font-mono">{basePath}</p>
        )}
      </div>

      <Separator />

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {renderContent()}
        </div>
      </ScrollArea>

      <Separator />

      {/* Footer Actions */}
      <div className="p-4 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || saving || !dirty}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all changes?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will discard all unsaved changes and restore the data to its last saved state.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {dirty && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Unsaved changes
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={loading || saving || !dirty}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

export { ObjectEditor, ArrayEditor, ArrayListEditor };
export { NestedFieldCard } from './NestedFieldCard';

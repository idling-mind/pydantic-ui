import { useMemo, useCallback, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { 
  ColDef, 
  CellValueChangedEvent,
  GridReadyEvent,
  GridApi,
  RowDragEndEvent,
} from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { Plus, Trash2, Copy, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import type { SchemaField, FieldError } from '@/types';
import {
  flattenSchema,
  arrayToFlatRows,
  generateColumnDefs,
  setValueByPath,
  type FlatRow,
  type FlattenedField,
} from '@/lib/tableUtils';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface TableViewProps {
  name: string;
  path: string;
  schema: SchemaField;
  value: unknown[] | null | undefined;
  errors?: FieldError[];
  disabled?: boolean;
  onChange: (value: unknown) => void;
}

export function TableView({
  name: _name,
  path,
  schema,
  value,
  errors,
  disabled,
  onChange,
}: TableViewProps) {
  const { theme } = useTheme();
  const gridRef = useRef<AgGridReact>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  const items = value || [];
  const itemSchema = schema.items;
  const minItems = schema.min_items;
  const maxItems = schema.max_items;

  const canAdd = maxItems === undefined || items.length < maxItems;
  const canRemove = minItems === undefined || items.length > minItems;

  // Flatten the item schema to get all columns
  const flattenedFields: FlattenedField[] = useMemo(() => {
    if (!itemSchema) return [];
    return flattenSchema(itemSchema, '', 5);
  }, [itemSchema]);

  // Convert data to flat rows
  const rowData: FlatRow[] = useMemo(() => {
    return arrayToFlatRows(items, flattenedFields);
  }, [items, flattenedFields]);

  // Generate column definitions
  const columnDefs: ColDef[] = useMemo(() => {
    if (flattenedFields.length === 0) return [];

    // Add row index column
    const indexCol: ColDef = {
      headerName: '#',
      field: '__rowIndex',
      width: 60,
      minWidth: 60,
      maxWidth: 80,
      editable: false,
      sortable: false,
      filter: false,
      pinned: 'left',
      lockPosition: 'left',
      cellStyle: { 
        fontWeight: 'bold',
        color: 'var(--ag-secondary-foreground-color)',
      },
      valueGetter: (params) => (params.data?.__rowIndex ?? 0) + 1,
      rowDrag: !disabled,
    };

    const dataCols = generateColumnDefs(flattenedFields, rowData);

    return [indexCol, ...dataCols];
  }, [flattenedFields, rowData, disabled]);

  // Default column definition
  const defaultColDef: ColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    editable: !disabled,
    minWidth: 80,
  }), [disabled]);

  // Handle grid ready
  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    // Auto-size columns to fit content
    params.api.sizeColumnsToFit();
  }, []);

  // Handle cell value change
  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const rowIndex = event.data.__rowIndex;
    const field = event.colDef.field;
    
    if (field && field !== '__rowIndex' && rowIndex !== undefined) {
      const newItems = [...items];
      const currentItem = newItems[rowIndex];
      
      // Update the nested value in the original item
      const updatedItem = setValueByPath(currentItem, field, event.newValue);
      newItems[rowIndex] = updatedItem;
      
      onChange(newItems);
    }
  }, [items, onChange]);

  // Handle row drag end (reordering)
  const onRowDragEnd = useCallback((event: RowDragEndEvent) => {
    const movingNode = event.node;
    const overNode = event.overNode;
    
    if (!movingNode || !overNode) return;
    
    const fromIndex = movingNode.data.__rowIndex;
    const toIndex = overNode.data.__rowIndex;
    
    if (fromIndex === toIndex) return;
    
    const newItems = [...items];
    const [removed] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, removed);
    
    onChange(newItems);
  }, [items, onChange]);

  // Handle selection change
  const onSelectionChanged = useCallback(() => {
    if (!gridApi) return;
    const selected = gridApi.getSelectedRows() as FlatRow[];
    setSelectedRows(selected.map(row => row.__rowIndex));
  }, [gridApi]);

  // Add new row
  const handleAddRow = useCallback(() => {
    if (!canAdd || !itemSchema) return;

    // Create default value based on item type
    let defaultValue: unknown = null;
    if (itemSchema.type === 'object') {
      defaultValue = {};
    } else if (itemSchema.type === 'array') {
      defaultValue = [];
    } else if (itemSchema.type === 'string') {
      defaultValue = '';
    } else if (itemSchema.type === 'integer' || itemSchema.type === 'number') {
      defaultValue = 0;
    } else if (itemSchema.type === 'boolean') {
      defaultValue = false;
    }

    const newItems = [...items, defaultValue];
    onChange(newItems);
  }, [canAdd, items, itemSchema, onChange]);

  // Delete selected rows
  const handleDeleteSelected = useCallback(() => {
    if (!canRemove || selectedRows.length === 0) return;

    // Sort indices in descending order to delete from end first
    const sortedIndices = [...selectedRows].sort((a, b) => b - a);
    const newItems = [...items];
    
    for (const index of sortedIndices) {
      if (newItems.length > (minItems || 0)) {
        newItems.splice(index, 1);
      }
    }
    
    onChange(newItems);
    setSelectedRows([]);
  }, [canRemove, selectedRows, items, minItems, onChange]);

  // Duplicate selected rows
  const handleDuplicateSelected = useCallback(() => {
    if (!canAdd || selectedRows.length === 0) return;

    const newItems = [...items];
    // Sort indices in ascending order
    const sortedIndices = [...selectedRows].sort((a, b) => a - b);
    
    // Insert duplicates after each selected row (adjusted for previous insertions)
    let offset = 0;
    for (const index of sortedIndices) {
      const itemToDuplicate = JSON.parse(JSON.stringify(items[index]));
      const insertAt = index + offset + 1;
      
      if (maxItems === undefined || newItems.length < maxItems) {
        newItems.splice(insertAt, 0, itemToDuplicate);
        offset++;
      }
    }
    
    onChange(newItems);
    setSelectedRows([]);
  }, [canAdd, selectedRows, items, maxItems, onChange]);

  // Determine theme
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Apply custom theme based on shadcn/ui variables
  const gridTheme = useMemo(() => {
    return themeQuartz.withParams({
      accentColor: 'hsl(var(--primary))',
      backgroundColor: 'hsl(var(--background))',
      foregroundColor: 'hsl(var(--foreground))',
      borderColor: 'hsl(var(--border))',
      headerBackgroundColor: 'hsl(var(--muted))',
      headerTextColor: 'hsl(var(--foreground))',
      oddRowBackgroundColor: 'hsl(var(--muted) / 0.3)',
      rowHoverColor: 'hsl(var(--accent))',
      selectedRowBackgroundColor: 'hsl(var(--accent))',
      cellHorizontalPaddingScale: 0.8,
      rowVerticalPaddingScale: 0.8,
      headerFontSize: 12,
      fontSize: 13,
      borderRadius: 6,
    });
  }, [isDark]);

  // Error display
  const arrayErrors = errors?.filter(e => e.path === path) || [];

  if (!itemSchema) {
    return (
      <div className="p-4 text-center text-muted-foreground border border-dashed rounded-md">
        Cannot display table view: array items schema is not defined.
      </div>
    );
  }

  if (flattenedFields.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground border border-dashed rounded-md">
        Cannot display table view: no fields found in item schema.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddRow}
            disabled={disabled || !canAdd}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Row
          </Button>
          {selectedRows.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDuplicateSelected}
                disabled={disabled || !canAdd}
              >
                <Copy className="h-4 w-4 mr-1" />
                Duplicate ({selectedRows.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={disabled || !canRemove}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete ({selectedRows.length})
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GripVertical className="h-4 w-4" />
          <span>Drag rows to reorder</span>
          <span className="mx-2">•</span>
          <span>{items.length} row{items.length !== 1 ? 's' : ''}</span>
          {minItems !== undefined && <span>(min: {minItems})</span>}
          {maxItems !== undefined && <span>(max: {maxItems})</span>}
        </div>
      </div>

      {/* AG Grid */}
      <div 
        className={cn(
          'rounded-md border overflow-hidden',
          isDark ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'
        )}
        style={{ height: Math.min(400, Math.max(200, items.length * 42 + 56)) }}
      >
        <AgGridReact
          ref={gridRef}
          theme={gridTheme}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          onCellValueChanged={onCellValueChanged}
          onRowDragEnd={onRowDragEnd}
          onSelectionChanged={onSelectionChanged}
          rowSelection="multiple"
          rowDragManaged={true}
          animateRows={true}
          suppressRowClickSelection={true}
          getRowId={(params) => String(params.data.__rowIndex)}
          rowHeight={36}
          headerHeight={40}
          domLayout="normal"
          stopEditingWhenCellsLoseFocus={true}
          singleClickEdit={true}
        />
      </div>

      {/* Error display */}
      {arrayErrors.length > 0 && (
        <p className="text-sm text-destructive">{arrayErrors[0].message}</p>
      )}
    </div>
  );
}

export default TableView;

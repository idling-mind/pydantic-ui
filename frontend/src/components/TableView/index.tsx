import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { RevoGrid } from '@revolist/react-datagrid';
import type {
  ColumnRegular,
  ColumnGrouping,
  AfterEditEvent,
  BeforeSaveDataDetails,
  BeforeRangeSaveDataDetails,
  DataType,
  Editors,
} from '@revolist/react-datagrid';
import { Plus, Trash2, Copy, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useData } from '@/context/DataContext';
import type { SchemaField, FieldError } from '@/types';
import {
  flattenSchema,
  arrayToFlatRows,
  generateColumnDefs,
  setValueByPath,
  type FlattenedField,
} from '@/lib/tableUtils';
import {
  textEditor,
  numberEditor,
  textareaEditor,
  jsonEditor,
  selectEditor,
  dateEditor,
  colorEditor,
  multiselectEditor,
} from './editors';
import {
  TABLE_CELL_EDIT_EVENT,
  TABLE_CELL_OPEN_EDITOR_EVENT,
  type TableCellEditDetail,
  type TableCellOpenEditorDetail,
} from './cells';

interface TableViewProps {
  name: string;
  path: string;
  schema: SchemaField;
  value: unknown[] | null | undefined;
  errors?: FieldError[];
  disabled?: boolean;
  onChange: (value: unknown) => void;
}

const DEFAULT_TABLE_PINNED_COLUMNS = ['__check', '__row_number'];

function normalizePinnedColumnKey(key: string): string {
  const normalized = key.trim();
  if (!normalized) {
    return normalized;
  }
  if (
    normalized === '__displayIndex' ||
    normalized === '__rowIndex' ||
    normalized === '__row_number' ||
    normalized === '#'
  ) {
    return '__row_number';
  }
  return normalized;
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
  const { config } = useData();
  const gridRef = useRef<HTMLRevoGridElement>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const items = value || [];
  const itemSchema = schema.items;
  const minItems = schema.min_items;
  const maxItems = schema.max_items;

  const canAdd = maxItems === undefined || items.length < maxItems;
  const canRemove = minItems === undefined || items.length > minItems;

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const gridTheme = isDark ? 'darkCompact' : 'compact';

  const normalizedPinnedColumns = useMemo(() => {
    const configured =
      config?.table_pinned_columns && config.table_pinned_columns.length > 0
        ? config.table_pinned_columns
        : DEFAULT_TABLE_PINNED_COLUMNS;
    return new Set(
      configured
        .map(normalizePinnedColumnKey)
        .filter((columnKey) => columnKey.length > 0),
    );
  }, [config?.table_pinned_columns]);

  const pinnedDataColumns = useMemo(() => {
    const dataColumns = new Set<string>();
    for (const key of normalizedPinnedColumns) {
      if (key === '__check' || key === '__row_number') {
        continue;
      }
      dataColumns.add(key);
    }
    return dataColumns;
  }, [normalizedPinnedColumns]);

  const applySingleCellEdit = useCallback(
    (rowIndex: number, field: string, valueToSet: unknown) => {
      if (
        field === '__rowIndex' ||
        field === '__displayIndex' ||
        field === '__check' ||
        field === '__originalData'
      ) {
        return;
      }
      if (rowIndex < 0 || rowIndex >= items.length) {
        return;
      }

      const newItems = [...items];
      const currentItem = newItems[rowIndex] ?? {};
      newItems[rowIndex] = setValueByPath(currentItem, field, valueToSet);
      onChange(newItems);
    },
    [items, onChange],
  );

  // Flatten the item schema to get all columns
  const flattenedFields: FlattenedField[] = useMemo(() => {
    if (!itemSchema) return [];
    return flattenSchema(itemSchema, '', 5);
  }, [itemSchema]);

  // Convert data to flat rows (add __displayIndex for the index column)
  const rowData: DataType[] = useMemo(() => {
    const rows = arrayToFlatRows(items, flattenedFields) as DataType[];
    for (const row of rows) {
      row.__displayIndex = (row.__rowIndex as number) + 1;
    }
    return rows;
  }, [items, flattenedFields]);

  // Generate column definitions
  const columnDefs: (ColumnRegular | ColumnGrouping)[] = useMemo(() => {
    if (flattenedFields.length === 0) return [];

    // Checkbox column for selection
    const checkCol: ColumnRegular = {
      prop: '__check',
      name: '',
      size: 40,
      minSize: 40,
      maxSize: 40,
      readonly: true,
      sortable: false,
      pin: normalizedPinnedColumns.has('__check') ? 'colPinStart' : undefined,
      cellTemplate: (h, props) => {
        const idx: number = props.model.__rowIndex ?? props.rowIndex;
        const checked = selectedRows.has(idx);
        return h(
          'label',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              cursor: 'pointer',
            },
          },
          h('input', {
            type: 'checkbox',
            checked,
            style: { cursor: 'pointer' },
            onChange: (e: Event) => {
              e.stopPropagation();
              setSelectedRows((prev) => {
                const next = new Set(prev);
                if (next.has(idx)) {
                  next.delete(idx);
                } else {
                  next.add(idx);
                }
                return next;
              });
            },
          }),
        );
      },
    };

    // Row index column — no cellTemplate so RevoGrid renders the drag handle
    const indexCol: ColumnRegular = {
      prop: '__displayIndex',
      name: '#',
      size: 60,
      minSize: 60,
      maxSize: 70,
      readonly: true,
      sortable: false,
      pin: normalizedPinnedColumns.has('__row_number') ? 'colPinStart' : undefined,
      rowDrag: !disabled,
    };

    const dataCols = generateColumnDefs(flattenedFields, {
      readOnly: !!disabled,
      pinnedColumnsStart: pinnedDataColumns,
    });

    return [checkCol, indexCol, ...dataCols];
  }, [flattenedFields, disabled, selectedRows, normalizedPinnedColumns, pinnedDataColumns]);

  // Custom editors for field types
  const editors: Editors = useMemo(() => ({
    text: textEditor,
    number: numberEditor,
    textarea: textareaEditor,
    json: jsonEditor,
    select: selectEditor,
    date: dateEditor,
    color: colorEditor,
    multiselect: multiselectEditor,
  }), []);

  useEffect(() => {
    const gridElement = gridRef.current;
    if (!gridElement) {
      return;
    }

    const handleTemplateCellEdit = (event: Event) => {
      const customEvent = event as CustomEvent<TableCellEditDetail>;
      const detail = customEvent.detail;
      if (!detail) {
        return;
      }
      applySingleCellEdit(detail.rowIndex, detail.prop, detail.val);
    };

    const handleTemplateOpenEditor = (event: Event) => {
      if (disabled) {
        return;
      }
      const customEvent = event as CustomEvent<TableCellOpenEditorDetail>;
      const detail = customEvent.detail;
      if (!detail) {
        return;
      }
      void gridElement.setCellEdit(detail.rowIndex, detail.prop, 'rgRow');
    };

    gridElement.addEventListener(TABLE_CELL_EDIT_EVENT, handleTemplateCellEdit as EventListener);
    gridElement.addEventListener(TABLE_CELL_OPEN_EDITOR_EVENT, handleTemplateOpenEditor as EventListener);

    return () => {
      gridElement.removeEventListener(TABLE_CELL_EDIT_EVENT, handleTemplateCellEdit as EventListener);
      gridElement.removeEventListener(TABLE_CELL_OPEN_EDITOR_EVENT, handleTemplateOpenEditor as EventListener);
    };
  }, [applySingleCellEdit, disabled]);

  useEffect(() => {
    const gridElement = gridRef.current;
    if (!gridElement) {
      return;
    }

    const syncViewport = () => {
      void gridElement.refresh('all');

      const horizontalScrollbar =
        gridElement.querySelector('revogr-scroll-virtual.horizontal') ||
        gridElement.shadowRoot?.querySelector('revogr-scroll-virtual.horizontal');

      if (horizontalScrollbar) {
        horizontalScrollbar.setAttribute('autohide', 'false');
      }
    };

    const rafId = window.requestAnimationFrame(syncViewport);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [columnDefs, rowData.length, gridTheme]);

  // Handle cell edit (single cell + range paste)
  const handleAfteredit = useCallback(
    (event: CustomEvent<AfterEditEvent>) => {
      const detail = event.detail;

      // Single cell edit (BeforeSaveDataDetails)
      if ('prop' in detail && 'model' in detail) {
        const d = detail as BeforeSaveDataDetails;
        const rowIndex = d.model?.__rowIndex ?? d.rowIndex;
        const field = String(d.prop);

        if (rowIndex === undefined) return;

        applySingleCellEdit(rowIndex, field, d.val);
      }
      // Range edit / paste from clipboard (BeforeRangeSaveDataDetails)
      else if ('data' in detail) {
        const rangeDetail = detail as BeforeRangeSaveDataDetails;
        const newItems = [...items];

        for (const [rowIndexStr, rowChanges] of Object.entries(rangeDetail.data)) {
          const rowIndex = parseInt(rowIndexStr, 10);
          if (isNaN(rowIndex) || rowIndex < 0 || rowIndex >= newItems.length) continue;

          const changedRow = rowChanges as Record<string, unknown>;
          for (const [prop, value] of Object.entries(changedRow)) {
            if (prop === '__rowIndex' || prop === '__displayIndex' || prop === '__check' || prop === '__originalData') continue;
            const currentItem = newItems[rowIndex] ?? {};
            newItems[rowIndex] = setValueByPath(currentItem, prop, value);
          }
        }

        onChange(newItems);
      }
    },
    [applySingleCellEdit, items, onChange],
  );

  // Handle row reorder
  const handleRowOrderChanged = useCallback(
    (event: CustomEvent<{ from: number; to: number }>) => {
      const { from, to } = event.detail;
      if (from === to) return;

      const newItems = [...items];
      const [removed] = newItems.splice(from, 1);
      newItems.splice(to, 0, removed);
      onChange(newItems);
    },
    [items, onChange],
  );

  // Add new row
  const handleAddRow = useCallback(() => {
    if (!canAdd || !itemSchema) return;

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
    if (!canRemove || selectedRows.size === 0) return;

    const sortedIndices = [...selectedRows].sort((a, b) => b - a);
    const newItems = [...items];

    for (const index of sortedIndices) {
      if (newItems.length > (minItems || 0)) {
        newItems.splice(index, 1);
      }
    }

    onChange(newItems);
    setSelectedRows(new Set());
  }, [canRemove, selectedRows, items, minItems, onChange]);

  // Duplicate selected rows
  const handleDuplicateSelected = useCallback(() => {
    if (!canAdd || selectedRows.size === 0) return;

    const newItems = [...items];
    const sortedIndices = [...selectedRows].sort((a, b) => a - b);

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
    setSelectedRows(new Set());
  }, [canAdd, selectedRows, items, maxItems, onChange]);

  // Error display
  const arrayErrors = errors?.filter((e) => e.path === path) || [];

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
    <div className="flex w-full min-w-0 flex-col gap-4" data-pydantic-ui="table-view" data-pydantic-ui-path={path}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2" data-pydantic-ui="table-toolbar">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddRow}
            disabled={disabled || !canAdd}
            data-pydantic-ui="table-add-row"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Row
          </Button>
          {selectedRows.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDuplicateSelected}
                disabled={disabled || !canAdd}
                data-pydantic-ui="table-duplicate-rows"
              >
                <Copy className="h-4 w-4 mr-1" />
                Duplicate ({selectedRows.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={disabled || !canRemove}
                className="text-destructive hover:text-destructive"
                data-pydantic-ui="table-delete-rows"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete ({selectedRows.size})
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GripVertical className="h-4 w-4" />
          <span>Drag rows to reorder</span>
          <span className="mx-2">•</span>
          <span>
            {items.length} row{items.length !== 1 ? 's' : ''}
          </span>
          {minItems !== undefined && <span>(min: {minItems})</span>}
          {maxItems !== undefined && <span>(max: {maxItems})</span>}
        </div>
      </div>

      {/* RevoGrid */}
      <div
        className={cn('w-full max-w-full min-w-0 rounded-md border overflow-hidden', isDark ? 'revogrid-dark' : 'revogrid-light')}
        style={{ height: 'calc(100vh - 400px)', minHeight: '200px' }}
        data-pydantic-ui="table-grid"
      >
        <div
          className="h-full w-full max-w-full min-w-0"
          data-pydantic-ui="table-grid-inner"
        >
          <RevoGrid
            ref={gridRef}
            theme={gridTheme}
            colSize={100}
            source={rowData}
            columns={columnDefs}
            editors={editors}
            readonly={disabled}
            resize={true}
            stretch={false}
            range={true}
            useClipboard={true}
            rowHeaders={false}
            rowSize={36}
            filter={true}
            canDrag={!disabled}
            onAfteredit={handleAfteredit}
            onRoworderchanged={handleRowOrderChanged}
            style={{ height: '100%', width: '100%' }}
          />
        </div>
      </div>

      {/* Error display */}
      {arrayErrors.length > 0 && (
        <p className="text-sm text-destructive">{arrayErrors[0].message}</p>
      )}
    </div>
  );
}

export default TableView;

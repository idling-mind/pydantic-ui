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
import { Plus, Trash2, Copy, GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useData } from '@/context/DataContext';
import type { SchemaField, FieldError } from '@/types';
import {
  applyColumnSizes,
  flattenSchema,
  arrayToFlatRows,
  coerceTableCellValueBySchema,
  generateColumnDefs,
  normalizeColumnWidthPropKey,
  resolveConfiguredColumnSizes,
  setValueByPath,
  type ColumnWidthConfig,
  type FlattenedField,
} from '@/lib/tableUtils';
import {
  textEditor,
  numberEditor,
  sliderEditor,
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
const TABLE_COLUMN_SIZES_STORAGE_KEY_PREFIX = 'pydantic-ui:table-column-sizes:v1';

function getTableColumnSizesStorageKey(tablePath: string, schemaName?: string): string {
  const safeSchema = schemaName?.trim() || '__unknown_schema__';
  const safePath = tablePath.trim() || '__root__';
  return `${TABLE_COLUMN_SIZES_STORAGE_KEY_PREFIX}:${safeSchema}:${safePath}`;
}

function loadColumnSizesFromLocalStorage(storageKey: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const sizesByProp: Record<string, number> = {};
    for (const [prop, width] of Object.entries(parsed)) {
      if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) {
        continue;
      }

      const normalizedProp = normalizeColumnWidthPropKey(prop);
      if (!normalizedProp) {
        continue;
      }

      sizesByProp[normalizedProp] = width;
    }

    return sizesByProp;
  } catch {
    // Ignore malformed storage payloads.
    return {};
  }
}

function saveColumnSizesToLocalStorage(
  storageKey: string,
  sizesByProp: Readonly<Record<string, number>>,
): void {
  try {
    if (Object.keys(sizesByProp).length === 0) {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(sizesByProp));
  } catch {
    // Ignore persistence failures.
  }
}

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
  const { config, data, schema: rootSchema } = useData();
  const gridRef = useRef<HTMLRevoGridElement>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [columnSizesByProp, setColumnSizesByProp] = useState<Record<string, number>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  const tablePinnedColumnsOverride =
    schema.ui_config?.display?.table?.pinned_columns;
  const tableColumnWidthsOverride =
    schema.ui_config?.display?.table?.column_widths;

  const normalizedPinnedColumns = useMemo(() => {
    const configured =
      tablePinnedColumnsOverride && tablePinnedColumnsOverride.length > 0
        ? tablePinnedColumnsOverride
        : config?.table_pinned_columns && config.table_pinned_columns.length > 0
          ? config.table_pinned_columns
          : DEFAULT_TABLE_PINNED_COLUMNS;
    return new Set(
      configured
        .map(normalizePinnedColumnKey)
        .filter((columnKey) => columnKey.length > 0),
    );
  }, [tablePinnedColumnsOverride, config?.table_pinned_columns]);

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

  // Flatten the item schema to get all columns
  const flattenedFields: FlattenedField[] = useMemo(() => {
    if (!itemSchema) return [];
    return flattenSchema(itemSchema, '', 5);
  }, [itemSchema]);

  const fieldSchemaByPath = useMemo(() => {
    const schemaByPath = new Map<string, SchemaField>();
    for (const field of flattenedFields) {
      schemaByPath.set(field.path, field.schema);
    }
    return schemaByPath;
  }, [flattenedFields]);

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

      const schemaForField = fieldSchemaByPath.get(field);
      const normalizedValue = coerceTableCellValueBySchema(schemaForField, valueToSet);
      const newItems = [...items];
      const currentItem = newItems[rowIndex] ?? {};
      newItems[rowIndex] = setValueByPath(currentItem, field, normalizedValue);
      onChange(newItems);
    },
    [fieldSchemaByPath, items, onChange],
  );

  const effectiveColumnWidthConfig: ColumnWidthConfig =
    tableColumnWidthsOverride !== undefined && tableColumnWidthsOverride !== null
      ? tableColumnWidthsOverride
      : config?.table_column_widths;

  const configuredColumnSizesByProp = useMemo(
    () => resolveConfiguredColumnSizes(flattenedFields, effectiveColumnWidthConfig),
    [flattenedFields, effectiveColumnWidthConfig],
  );

  const columnSizeStorageKey = useMemo(
    () => getTableColumnSizesStorageKey(path, rootSchema?.name),
    [path, rootSchema?.name],
  );

  const mergedColumnSizesByProp = useMemo(
    () => ({
      ...configuredColumnSizesByProp,
      ...columnSizesByProp,
    }),
    [configuredColumnSizesByProp, columnSizesByProp],
  );

  // Convert data to flat rows (add __displayIndex for the index column)
  const rowData: DataType[] = useMemo(() => {
    const rows = arrayToFlatRows(items, flattenedFields) as DataType[];
    for (const row of rows) {
      row.__displayIndex = (row.__rowIndex as number) + 1;
    }
    return rows;
  }, [items, flattenedFields]);

  useEffect(() => {
    setColumnSizesByProp(loadColumnSizesFromLocalStorage(columnSizeStorageKey));
  }, [columnSizeStorageKey]);

  useEffect(() => {
    saveColumnSizesToLocalStorage(columnSizeStorageKey, columnSizesByProp);
  }, [columnSizeStorageKey, columnSizesByProp]);

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
      data,
    });

    return applyColumnSizes([checkCol, indexCol, ...dataCols], mergedColumnSizesByProp);
  }, [flattenedFields, disabled, selectedRows, normalizedPinnedColumns, pinnedDataColumns, data, mergedColumnSizesByProp]);

  const handleAftercolumnresize = useCallback(
    (event: CustomEvent<Record<number, ColumnRegular>>) => {
      const resizedColumns = event.detail;
      if (!resizedColumns) {
        return;
      }

      setColumnSizesByProp((previous) => {
        let changed = false;
        const next = { ...previous };

        for (const column of Object.values(resizedColumns)) {
          const prop = column?.prop;
          const size = column?.size;

          if (
            (typeof prop === 'string' || typeof prop === 'number') &&
            typeof size === 'number' &&
            Number.isFinite(size)
          ) {
            const key = normalizeColumnWidthPropKey(String(prop));
            if (!key) {
              continue;
            }
            if (next[key] !== size) {
              next[key] = size;
              changed = true;
            }
          }
        }

        return changed ? next : previous;
      });
    },
    [],
  );

  // Custom editors for field types
  const editors: Editors = useMemo(() => ({
    text: textEditor,
    number: numberEditor,
    slider: sliderEditor,
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
  }, [columnDefs, rowData.length, gridTheme, isFullscreen]);

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
            const schemaForField = fieldSchemaByPath.get(prop);
            const normalizedValue = coerceTableCellValueBySchema(schemaForField, value);
            const currentItem = newItems[rowIndex] ?? {};
            newItems[rowIndex] = setValueByPath(currentItem, prop, normalizedValue);
          }
        }

        onChange(newItems);
      }
    },
    [applySingleCellEdit, fieldSchemaByPath, items, onChange],
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

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((previous) => !previous);
  }, []);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

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
    <div
      className={cn(
        'flex w-full min-w-0 flex-col gap-4',
        isFullscreen && 'fixed inset-0 z-[60] h-full overflow-auto bg-background p-4',
      )}
      data-pydantic-ui="table-view"
      data-pydantic-ui-path={path}
      data-pydantic-ui-fullscreen={isFullscreen ? 'true' : 'false'}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2" data-pydantic-ui="table-toolbar">
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleFullscreen}
            data-pydantic-ui="table-toggle-fullscreen"
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4 mr-1" /> : <Maximize2 className="h-4 w-4 mr-1" />}
            {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          </Button>
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
        style={
          isFullscreen
            ? { height: 'calc(100vh - 100px)', minHeight: '280px' }
            : { height: 'calc(100vh - 410px)', minHeight: '200px' }
        }
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
            onAftercolumnresize={handleAftercolumnresize}
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

import { describe, it, expect } from 'vitest';
import type { ColumnGrouping, ColumnRegular } from '@revolist/react-datagrid';
import type { SchemaField } from '../../src/types';
import {
  applyColumnSizes,
  arrayToFlatRows,
  createCellTemplate,
  generateFlatColumnDefs,
  getTableRenderer,
  normalizeColumnWidthPropKey,
  resolveConfiguredColumnSizes,
  type FlattenedField,
} from '../../src/lib/tableUtils';
import {
  TABLE_CELL_EDIT_EVENT,
  TABLE_CELL_OPEN_EDITOR_EVENT,
  type TableCellEditDetail,
  type TableCellOpenEditorDetail,
} from '../../src/components/TableView/cells';

interface VNodeLike {
  tag: string;
  props: Record<string, unknown>;
  children?: unknown;
}

const h = (tag: string, props: Record<string, unknown> = {}, children?: unknown): VNodeLike => ({
  tag,
  props,
  children,
});

function createField(path: string, schema: SchemaField): FlattenedField {
  return {
    path,
    schema,
    isLeaf: true,
  };
}

describe('getTableRenderer', () => {
  it('prefers configured renderer when present', () => {
    const renderer = getTableRenderer({
      type: 'string',
      ui_config: {
        renderer: 'textarea',
      },
    });

    expect(renderer).toBe('textarea');
  });

  it('uses toggle as default for boolean types', () => {
    expect(getTableRenderer({ type: 'boolean' })).toBe('toggle');
  });

  it('uses multi_select for arrays of enum values', () => {
    expect(
      getTableRenderer({
        type: 'array',
        items: {
          type: 'string',
          enum: ['a', 'b'],
        },
      }),
    ).toBe('multi_select');
  });

  it('uses slider when numeric bounds come from constraints', () => {
    expect(
      getTableRenderer({
        type: 'integer',
        constraints: {
          minimum: 5,
          maximum: 25,
        },
      }),
    ).toBe('slider');
  });
});

describe('generateFlatColumnDefs', () => {
  it('maps enum fields to select editor', () => {
    const fields = [
      createField('status', {
        type: 'string',
        enum: ['draft', 'published'],
      }),
    ];

    const [col] = generateFlatColumnDefs(fields, { readOnly: false }) as Array<Record<string, unknown>>;

    expect(col.editor).toBe('select');
    expect(col.__enumValues).toEqual(['draft', 'published']);
  });

  it('maps slider renderer fields to slider editor', () => {
    const fields = [
      createField('age', {
        type: 'integer',
        minimum: 0,
        maximum: 150,
        ui_config: {
          renderer: 'slider',
          props: {
            min: 10,
            max: 90,
            step: 5,
          },
        },
      }),
    ];

    const [col] = generateFlatColumnDefs(fields, { readOnly: false }) as Array<Record<string, unknown>>;

    expect(col.editor).toBe('slider');
    expect(col.__minimum).toBe(10);
    expect(col.__maximum).toBe(90);
    expect(col.__step).toBe(5);
  });

  it('maps constraint-based slider bounds to the slider editor', () => {
    const fields = [
      createField('score', {
        type: 'integer',
        ui_config: {
          renderer: 'slider',
        },
        constraints: {
          minimum: 20,
          maximum: 80,
        },
      }),
    ];

    const [col] = generateFlatColumnDefs(fields, { readOnly: false }) as Array<Record<string, unknown>>;

    expect(col.editor).toBe('slider');
    expect(col.__minimum).toBe(20);
    expect(col.__maximum).toBe(80);
    expect(col.__step).toBe(1);
  });

  it('resolves select options from options_from data source', () => {
    const fields = [
      createField('owner', {
        type: 'string',
        ui_config: {
          renderer: 'select',
          options_from: 'users.[].name',
        },
      }),
    ];

    const [col] = generateFlatColumnDefs(fields, {
      readOnly: false,
      data: {
        users: [{ name: 'Ada' }, { name: 'Grace' }, { name: 'Ada' }],
      },
    }) as Array<Record<string, unknown>>;

    expect(col.editor).toBe('select');
    expect(col.__enumValues).toEqual(['Ada', 'Grace']);
  });

  it('keeps boolean columns on event-driven mode without native editor', () => {
    const fields = [
      createField('active', {
        type: 'boolean',
      }),
    ];

    const [col] = generateFlatColumnDefs(fields, { readOnly: false }) as Array<Record<string, unknown>>;

    expect(col.readonly).toBe(true);
    expect(col.editor).toBeUndefined();
    expect(typeof col.cellTemplate).toBe('function');
  });

  it('keeps multi_select array columns editable', () => {
    const fields = [
      createField('tags', {
        type: 'array',
        ui_config: {
          renderer: 'multi_select',
        },
        items: {
          type: 'string',
          enum: ['urgent', 'blocked', 'done'],
        },
      }),
    ];

    const [col] = generateFlatColumnDefs(fields, { readOnly: false }) as Array<Record<string, unknown>>;

    expect(col.readonly).toBe(false);
    expect(col.editor).toBe('multiselect');
    expect(col.__enumValues).toEqual(['urgent', 'blocked', 'done']);
  });

  it('pins configured data columns at the start', () => {
    const fields = [
      createField('email', {
        type: 'string',
      }),
    ];

    const [col] = generateFlatColumnDefs(fields, {
      readOnly: false,
      pinnedColumnsStart: new Set(['email']),
    }) as Array<Record<string, unknown>>;

    expect(col.pin).toBe('colPinStart');
  });
});

describe('arrayToFlatRows', () => {
  it('uses schema default when value is undefined', () => {
    const fields = [
      createField('role', {
        type: 'string',
        default: 'Engineer',
      }),
    ];

    const rows = arrayToFlatRows([{}], fields);

    expect(rows[0].role).toBe('Engineer');
  });

  it('preserves explicit null without default fallback', () => {
    const fields = [
      createField('role', {
        type: 'string',
        default: 'Engineer',
      }),
    ];

    const rows = arrayToFlatRows([{ role: null }], fields);

    expect(rows[0].role).toBeNull();
  });
});

describe('applyColumnSizes', () => {
  it('applies persisted sizes to leaf and grouped columns without mutating originals', () => {
    const originalColumns: Array<ColumnRegular | ColumnGrouping> = [
      {
        prop: 'name',
        name: 'name',
        size: 120,
      },
      {
        name: 'meta',
        children: [
          {
            prop: 'status',
            name: 'status',
            size: 140,
          },
        ],
      },
    ];

    const resizedColumns = applyColumnSizes(originalColumns, {
      name: 260,
      status: 310,
    });

    expect((resizedColumns[0] as ColumnRegular).size).toBe(260);
    expect(((resizedColumns[1] as ColumnGrouping).children[0] as ColumnRegular).size).toBe(310);

    expect((originalColumns[0] as ColumnRegular).size).toBe(120);
    expect(((originalColumns[1] as ColumnGrouping).children[0] as ColumnRegular).size).toBe(140);
  });
});

describe('resolveConfiguredColumnSizes', () => {
  const flattenedFields = [
    createField('name', { type: 'string' }),
    createField('email', { type: 'string' }),
  ];

  it('applies shared numeric width to data columns only', () => {
    const widths = resolveConfiguredColumnSizes(flattenedFields, 180);

    expect(widths).toEqual({
      name: 180,
      email: 180,
    });
    expect(widths.__check).toBeUndefined();
    expect(widths.__displayIndex).toBeUndefined();
  });

  it('applies dictionary widths and normalizes row-number aliases', () => {
    const widths = resolveConfiguredColumnSizes(flattenedFields, {
      name: 220,
      __row_number: 72,
      '#': 68,
      invalid: -1,
    });

    expect(widths).toEqual({
      name: 220,
      __displayIndex: 68,
    });
  });

  it('ignores unsupported values', () => {
    expect(resolveConfiguredColumnSizes(flattenedFields, null)).toEqual({});
    expect(resolveConfiguredColumnSizes(flattenedFields, 0)).toEqual({});
    expect(resolveConfiguredColumnSizes(flattenedFields, -5)).toEqual({});
  });
});

describe('normalizeColumnWidthPropKey', () => {
  it('maps row-number aliases to __displayIndex', () => {
    expect(normalizeColumnWidthPropKey('__row_number')).toBe('__displayIndex');
    expect(normalizeColumnWidthPropKey('__rowIndex')).toBe('__displayIndex');
    expect(normalizeColumnWidthPropKey('#')).toBe('__displayIndex');
  });

  it('returns trimmed key for non-alias props', () => {
    expect(normalizeColumnWidthPropKey('  name  ')).toBe('name');
  });
});

describe('createCellTemplate', () => {
  it('dispatches edit event for boolean toggle clicks', () => {
    const template = createCellTemplate(
      createField('active', {
        type: 'boolean',
      }),
      { readOnly: false },
    );

    expect(template).toBeDefined();

    const vnode = template!(
      h as unknown as never,
      {
        model: { __rowIndex: 2, active: false },
        prop: 'active',
        rowIndex: 2,
      } as unknown as never,
    ) as unknown as VNodeLike;

    const button = document.createElement('button');
    let captured: TableCellEditDetail | null = null;

    button.addEventListener(TABLE_CELL_EDIT_EVENT, (event) => {
      captured = (event as CustomEvent<TableCellEditDetail>).detail;
    });

    (vnode.props.onClick as (event: Event) => void)({
      currentTarget: button,
      stopPropagation: () => {},
    } as unknown as Event);

    expect(captured).toEqual({
      rowIndex: 2,
      prop: 'active',
      val: true,
    });
  });

  it('dispatches open-editor event for select cells', () => {
    const template = createCellTemplate(
      createField('status', {
        type: 'string',
        enum: ['open', 'closed'],
      }),
      { readOnly: false },
    );

    expect(template).toBeDefined();

    const vnode = template!(
      h as unknown as never,
      {
        model: { __rowIndex: 1, status: 'open' },
        prop: 'status',
        rowIndex: 1,
      } as unknown as never,
    ) as unknown as VNodeLike;

    const button = document.createElement('button');
    let captured: TableCellOpenEditorDetail | null = null;

    button.addEventListener(TABLE_CELL_OPEN_EDITOR_EVENT, (event) => {
      captured = (event as CustomEvent<TableCellOpenEditorDetail>).detail;
    });

    (vnode.props.onMouseDown as (event: Event) => void)({
      currentTarget: button,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as Event);

    expect(captured).toEqual({
      rowIndex: 1,
      prop: 'status',
    });
  });

  it('dispatches open-editor event for slider cells', () => {
    const template = createCellTemplate(
      createField('age', {
        type: 'integer',
        ui_config: {
          renderer: 'slider',
          props: {
            min: 0,
            max: 100,
          },
        },
      }),
      { readOnly: false },
    );

    expect(template).toBeDefined();

    const vnode = template!(
      h as unknown as never,
      {
        model: { __rowIndex: 4, age: 20 },
        prop: 'age',
        rowIndex: 4,
      } as unknown as never,
    ) as unknown as VNodeLike;

    const button = document.createElement('button');
    let captured: TableCellOpenEditorDetail | null = null;

    button.addEventListener(TABLE_CELL_OPEN_EDITOR_EVENT, (event) => {
      captured = (event as CustomEvent<TableCellOpenEditorDetail>).detail;
    });

    (vnode.props.onClick as (event: Event) => void)({
      currentTarget: button,
      stopPropagation: () => {},
    } as unknown as Event);

    expect(captured).toEqual({
      rowIndex: 4,
      prop: 'age',
    });
  });
});
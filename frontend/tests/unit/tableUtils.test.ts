import { describe, it, expect } from 'vitest';
import type { SchemaField } from '../../src/types';
import {
  arrayToFlatRows,
  createCellTemplate,
  generateFlatColumnDefs,
  getTableRenderer,
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
});
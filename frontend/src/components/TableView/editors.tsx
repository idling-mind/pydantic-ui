import { useEffect, useRef, useState } from 'react';
import { Editor } from '@revolist/react-datagrid';
import type { EditorType } from '@revolist/react-datagrid';

/**
 * Boolean editor — immediately toggles the value and saves.
 */
function BooleanEditorComponent({ column, save }: EditorType) {
  useEffect(() => {
    const currentVal = column.model[column.prop];
    save(!currentVal, true);
  }, []);

  return <div style={{ display: 'none' }} />;
}

function getInitialTextValue(column: EditorType['column']): string {
  if (column.val !== undefined && column.val !== null) {
    return String(column.val);
  }

  const currentVal = column.model[column.prop];
  return currentVal != null ? String(currentVal) : '';
}

/**
 * Text editor — default inline editor used by text-like renderers.
 */
function TextEditorComponent({ column, save, close }: EditorType) {
  const [value, setValue] = useState(() => getInitialTextValue(column));
  const inputRef = useRef<HTMLInputElement>(null);
  const startedFromTyping = column.val !== undefined && column.val !== null;

  useEffect(() => {
    inputRef.current?.focus();
    if (!inputRef.current) {
      return;
    }

    if (startedFromTyping) {
      const end = inputRef.current.value.length;
      inputRef.current.setSelectionRange(end, end);
      return;
    }

    inputRef.current.select();
  }, []);

  const commitValue = () => {
    save(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitValue();
    } else if (e.key === 'Escape') {
      close();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={commitValue}
      style={editorInputStyle}
    />
  );
}

/**
 * Number editor — numeric input that respects integer vs float type.
 */
function NumberEditorComponent({ column, save, close }: EditorType) {
  const isInt = column.column.__isInteger;
  const min = column.column.__minimum;
  const max = column.column.__maximum;
  const step = column.column.__step ?? (isInt ? 1 : 'any');
  const [value, setValue] = useState(() => getInitialTextValue(column));
  const inputRef = useRef<HTMLInputElement>(null);
  const startedFromTyping = column.val !== undefined && column.val !== null;

  useEffect(() => {
    inputRef.current?.focus();
    if (!inputRef.current) {
      return;
    }

    if (startedFromTyping) {
      const end = inputRef.current.value.length;
      inputRef.current.setSelectionRange(end, end);
      return;
    }

    inputRef.current.select();
  }, []);

  const commitValue = () => {
    if (value === '') {
      save(null);
      return;
    }
    const parsed = isInt ? parseInt(value, 10) : parseFloat(value);
    save(isNaN(parsed) ? null : parsed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitValue();
    } else if (e.key === 'Escape') {
      close();
    }
  };

  return (
    <input
      ref={inputRef}
      type="number"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      min={typeof min === 'number' ? min : undefined}
      max={typeof max === 'number' ? max : undefined}
      step={step}
      onKeyDown={handleKeyDown}
      onBlur={commitValue}
      style={editorInputStyle}
    />
  );
}

/**
 * Textarea editor — used by text_area/markdown renderers.
 */
function TextareaEditorComponent({ column, save, close }: EditorType) {
  const [value, setValue] = useState(() => getInitialTextValue(column));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const startedFromTyping = column.val !== undefined && column.val !== null;

  useEffect(() => {
    textareaRef.current?.focus();
    if (!textareaRef.current) {
      return;
    }

    if (startedFromTyping) {
      const end = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(end, end);
      return;
    }

    textareaRef.current.select();
  }, []);

  const commitValue = () => {
    save(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commitValue();
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={commitValue}
      rows={4}
      style={editorTextareaStyle}
    />
  );
}

/**
 * JSON editor — validates JSON before save.
 */
function JsonEditorComponent({ column, save, close }: EditorType) {
  const currentVal = column.model[column.prop];
  const initialValue = (() => {
    if (column.val !== undefined && column.val !== null) {
      return String(column.val);
    }

    if (currentVal === null || currentVal === undefined) return '';
    if (typeof currentVal === 'string') return currentVal;
    try {
      return JSON.stringify(currentVal, null, 2);
    } catch {
      return String(currentVal);
    }
  })();

  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const commitValue = () => {
    if (!value.trim()) {
      save(null);
      return;
    }

    try {
      save(JSON.parse(value));
    } catch {
      // Keep editor open for correction by restoring focus.
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commitValue();
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={commitValue}
      rows={6}
      style={editorJsonStyle}
    />
  );
}

/**
 * Select editor — dropdown for enum / Literal values.
 */
function SelectEditorComponent({ column, save, close }: EditorType) {
  const enumValues: string[] = column.column.__enumValues || [];
  const currentVal = column.model[column.prop];
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const select = selectRef.current;
    if (!select) {
      return;
    }

    select.focus();

    const pickerCapable = select as HTMLSelectElement & {
      showPicker?: () => void;
    };

    if (typeof pickerCapable.showPicker === 'function') {
      try {
        pickerCapable.showPicker();
        return;
      } catch {
        // Fallback to click when picker is blocked.
      }
    }

    requestAnimationFrame(() => {
      select.click();
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    save(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
    }
  };

  return (
    <select
      ref={selectRef}
      value={currentVal != null ? String(currentVal) : ''}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className="revogrid-cell-select"
      style={editorInputStyle}
    >
      <option value="">—</option>
      {enumValues.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  );
}

/**
 * Date / DateTime editor — renders a native date or datetime-local input.
 * Reads `column.column.__includeTime` to decide format.
 */
function DateEditorComponent({ column, save, close }: EditorType) {
  const includeTime: boolean = column.column.__includeTime ?? false;
  const currentVal = column.model[column.prop];
  const inputRef = useRef<HTMLInputElement>(null);

  // Convert ISO / date string to the input format
  const toInputValue = (val: unknown): string => {
    if (!val) return '';
    const d = new Date(val as string);
    if (isNaN(d.getTime())) return '';
    if (includeTime) {
      // datetime-local needs YYYY-MM-DDTHH:MM
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    // date needs YYYY-MM-DD
    return d.toISOString().slice(0, 10);
  };

  const [value, setValue] = useState(toInputValue(currentVal));

  useEffect(() => {
    inputRef.current?.focus();
    // Open the native picker on focus
    inputRef.current?.showPicker?.();
  }, []);

  const commitValue = () => {
    if (!value) {
      save(null);
      return;
    }
    if (includeTime) {
      save(new Date(value).toISOString());
    } else {
      save(value); // YYYY-MM-DD string
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitValue();
    } else if (e.key === 'Escape') {
      close();
    }
  };

  return (
    <input
      ref={inputRef}
      type={includeTime ? 'datetime-local' : 'date'}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={commitValue}
      style={editorInputStyle}
    />
  );
}

/**
 * Color editor — renders a native color picker input.
 */
function ColorEditorComponent({ column, save, close }: EditorType) {
  const currentVal = column.model[column.prop];
  const [value, setValue] = useState(
    typeof currentVal === 'string' && currentVal.startsWith('#') ? currentVal : '#000000',
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.click(); // open native color picker
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const commitValue = () => {
    save(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitValue();
    } else if (e.key === 'Escape') {
      close();
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', height: '100%', padding: '0 8px' }}>
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={commitValue}
        style={{
          width: '28px',
          height: '22px',
          border: 'none',
          padding: 0,
          background: 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitValue}
        style={{
          ...editorInputStyle,
          padding: 0,
          flex: 1,
        }}
      />
    </div>
  );
}

/**
 * Multiselect editor — renders checkboxes for multi-value selection.
 * Reads `column.column.__enumValues` for the option list.
 * Value is stored as an array.
 */
function MultiselectEditorComponent({ column, save, close }: EditorType) {
  const enumValues: string[] = column.column.__enumValues || [];
  const currentVal = column.model[column.prop];
  const [selected, setSelected] = useState<string[]>(
    Array.isArray(currentVal) ? currentVal.map(String) : [],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<string[]>(selected);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!containerRef.current) {
        return;
      }
      if (target && containerRef.current.contains(target)) {
        return;
      }

      save(selectedRef.current);
      close(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [save, close]);

  const toggle = (val: string) => {
    setSelected((prev) => {
      const next = prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val];
      return next;
    });
  };

  const commitValue = () => {
    save(selected);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitValue();
      close(false);
    } else if (e.key === 'Escape') {
      close(false);
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="revogrid-multiselect-editor"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        minWidth: '100%',
        maxHeight: '200px',
        overflowY: 'auto',
        zIndex: 999,
        backgroundColor: 'hsl(var(--popover))',
        color: 'hsl(var(--popover-foreground))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: '4px 0',
      }}
    >
      {enumValues.map((val) => (
        <label
          key={val}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 10px',
            cursor: 'pointer',
            fontSize: '13px',
            whiteSpace: 'nowrap',
          }}
          onMouseDown={(e) => e.preventDefault()} // keep focus on container
        >
          <input
            type="checkbox"
            checked={selected.includes(val)}
            onChange={() => toggle(val)}
            style={{
              width: '14px',
              height: '14px',
              accentColor: 'hsl(var(--primary))',
            }}
          />
          {val}
        </label>
      ))}
      {enumValues.length === 0 && (
        <div style={{ padding: '4px 10px', color: 'hsl(var(--muted-foreground))' }}>
          No options available
        </div>
      )}
    </div>
  );
}

/** Shared inline style for editor inputs */
const editorInputStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  padding: '0 8px',
  border: '1px solid hsl(var(--input))',
  borderRadius: '6px',
  outline: 'none',
  background: 'hsl(var(--background))',
  color: 'hsl(var(--foreground))',
  fontSize: '13px',
  fontFamily: 'inherit',
};

const editorTextareaStyle: React.CSSProperties = {
  ...editorInputStyle,
  minHeight: '120px',
  lineHeight: 1.4,
  padding: '8px',
  resize: 'vertical',
};

const editorJsonStyle: React.CSSProperties = {
  ...editorTextareaStyle,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: '12px',
};

export const booleanEditor = Editor(BooleanEditorComponent);
export const textEditor = Editor(TextEditorComponent);
export const numberEditor = Editor(NumberEditorComponent);
export const textareaEditor = Editor(TextareaEditorComponent);
export const jsonEditor = Editor(JsonEditorComponent);
export const selectEditor = Editor(SelectEditorComponent);
export const dateEditor = Editor(DateEditorComponent);
export const colorEditor = Editor(ColorEditorComponent);
export const multiselectEditor = Editor(MultiselectEditorComponent);

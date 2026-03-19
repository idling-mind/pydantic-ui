import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

function placeCaretAtEnd(input: HTMLInputElement | HTMLTextAreaElement): void {
  const end = input.value.length;

  // Some input types (for example number) do not support selection APIs.
  try {
    input.setSelectionRange(end, end);
  } catch {
    // Ignore unsupported selection operations.
  }
}

/**
 * Text editor — default inline editor used by text-like renderers.
 */
function TextEditorComponent({ column, save, close }: EditorType) {
  const [value, setValue] = useState(() => getInitialTextValue(column));
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    placeCaretAtEnd(input);
  }, []);

  const commitValue = (preventFocusMove: boolean = false) => {
    if (committedRef.current) {
      return;
    }
    committedRef.current = true;
    save(value, preventFocusMove);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue(false);
    } else if (e.key === 'Escape') {
      committedRef.current = true;
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
      onBlur={() => commitValue(true)}
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
  const committedRef = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    placeCaretAtEnd(input);
  }, []);

  const commitValue = (preventFocusMove: boolean = false) => {
    if (committedRef.current) {
      return;
    }
    committedRef.current = true;

    if (value === '') {
      save(null, preventFocusMove);
      return;
    }
    const parsed = isInt ? parseInt(value, 10) : parseFloat(value);
    save(isNaN(parsed) ? null : parsed, preventFocusMove);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue(false);
    } else if (e.key === 'Escape') {
      committedRef.current = true;
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
      onBlur={() => commitValue(true)}
      style={editorInputStyle}
    />
  );
}

/**
 * Slider editor — native range input for slider/range renderers.
 */
function SliderEditorComponent({ column, save, close }: EditorType) {
  const isInt = column.column.__isInteger;
  const minimum = typeof column.column.__minimum === 'number' ? column.column.__minimum : 0;
  const maximum = typeof column.column.__maximum === 'number' ? column.column.__maximum : 100;
  const safeMaximum = maximum <= minimum ? minimum + 1 : maximum;
  const step =
    typeof column.column.__step === 'number'
      ? column.column.__step
      : isInt
        ? 1
        : 0.1;
  const currentVal = column.model[column.prop];
  const initialValue = (() => {
    const parsed = Number(currentVal);
    if (isNaN(parsed)) {
      return minimum;
    }
    return Math.min(safeMaximum, Math.max(minimum, parsed));
  })();

  const [value, setValue] = useState(initialValue);
  const valueRef = useRef(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commitValue = (preventFocusMove: boolean = true) => {
    if (committedRef.current) {
      return;
    }
    committedRef.current = true;
    save(valueRef.current, preventFocusMove);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value);
    if (isNaN(parsed)) {
      return;
    }
    const normalized = isInt ? Math.round(parsed) : parsed;
    const clamped = Math.min(safeMaximum, Math.max(minimum, normalized));
    setValue(clamped);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitValue(false);
    } else if (event.key === 'Escape') {
      committedRef.current = true;
      close();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        height: '100%',
        padding: '0 8px',
      }}
    >
      <input
        ref={inputRef}
        type="range"
        min={minimum}
        max={safeMaximum}
        step={step}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onMouseUp={() => commitValue(true)}
        onTouchEnd={() => commitValue(true)}
        onBlur={() => commitValue(true)}
        style={{
          flex: 1,
          width: '100%',
          margin: 0,
          accentColor: 'hsl(var(--primary))',
        }}
      />
      <span
        style={{
          minWidth: '28px',
          fontSize: '12px',
          fontVariantNumeric: 'tabular-nums',
          color: 'hsl(var(--foreground))',
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Textarea editor — used by text_area/markdown renderers.
 */
function TextareaEditorComponent({ column, save, close }: EditorType) {
  const [value, setValue] = useState(() => getInitialTextValue(column));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.focus();
    placeCaretAtEnd(textarea);
  }, []);

  const commitValue = (preventFocusMove: boolean = true) => {
    if (committedRef.current) {
      return;
    }
    committedRef.current = true;
    save(value, preventFocusMove);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      committedRef.current = true;
      close();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commitValue(true);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => commitValue(true)}
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
  const committedRef = useRef(false);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.focus();
    placeCaretAtEnd(textarea);
  }, []);

  const commitValue = (preventFocusMove: boolean = true) => {
    if (committedRef.current) {
      return;
    }

    if (!value.trim()) {
      committedRef.current = true;
      save(null, preventFocusMove);
      return;
    }

    try {
      committedRef.current = true;
      save(JSON.parse(value), preventFocusMove);
    } catch {
      // Keep editor open for correction by restoring focus.
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      committedRef.current = true;
      close();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commitValue(true);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => commitValue(true)}
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
  const currentValueRef = useRef<string>(currentVal != null ? String(currentVal) : '');
  const committedRef = useRef(false);

  const commitAndClose = (nextValue: string) => {
    if (committedRef.current) {
      return;
    }
    committedRef.current = true;
    currentValueRef.current = nextValue;
    // Use preventFocusMove=true to avoid unexpected focus jumps after committing.
    save(nextValue, true);
    close(false);
  };

  useEffect(() => {
    currentValueRef.current = currentVal != null ? String(currentVal) : '';
    committedRef.current = false;
  }, [currentVal, column.prop]);

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
    const nextValue = e.target.value;
    currentValueRef.current = nextValue;
    commitAndClose(nextValue);
  };

  const handleBlur = () => {
    // Selecting the same value doesn't fire onChange; blur ensures a commit/close path.
    commitAndClose(currentValueRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      committedRef.current = true;
      close();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      commitAndClose(currentValueRef.current);
    }
  };

  return (
    <select
      ref={selectRef}
      value={currentVal != null ? String(currentVal) : ''}
      onChange={handleChange}
      onBlur={handleBlur}
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
  const committedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    // Open the native picker on focus
    inputRef.current?.showPicker?.();
  }, []);

  const commitValue = (preventFocusMove: boolean = false) => {
    if (committedRef.current) {
      return;
    }
    committedRef.current = true;

    if (!value) {
      save(null, preventFocusMove);
      return;
    }
    if (includeTime) {
      save(new Date(value).toISOString(), preventFocusMove);
    } else {
      save(value, preventFocusMove); // YYYY-MM-DD string
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue(false);
    } else if (e.key === 'Escape') {
      committedRef.current = true;
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
      onBlur={() => commitValue(true)}
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
  const committedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.click(); // open native color picker
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const commitValue = (preventFocusMove: boolean = false) => {
    if (committedRef.current) {
      return;
    }
    committedRef.current = true;
    save(value, preventFocusMove);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue(false);
    } else if (e.key === 'Escape') {
      committedRef.current = true;
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
        onBlur={() => commitValue(true)}
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
        onBlur={() => commitValue(true)}
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
  const anchorRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<string[]>(selected);
  const committedRef = useRef(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties | null>(null);

  const updatePopupPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) {
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const viewportPadding = 8;
    const popupGap = 4;
    const maxPopupHeight = 240;
    const minPopupWidth = 180;

    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUpward = spaceBelow < 140 && spaceAbove > spaceBelow;
    const availableHeight = Math.max(80, openUpward ? spaceAbove : spaceBelow);
    const maxHeight = Math.min(maxPopupHeight, availableHeight);

    const width = Math.max(minPopupWidth, rect.width);
    const maxLeft = window.innerWidth - viewportPadding - width;
    const left = Math.max(viewportPadding, Math.min(rect.left, maxLeft));

    const top = openUpward
      ? Math.max(viewportPadding, rect.top - maxHeight - popupGap)
      : Math.min(window.innerHeight - viewportPadding - maxHeight, rect.bottom + popupGap);

    setPopupStyle({
      position: 'fixed',
      top,
      left,
      width,
      maxHeight,
      overflowY: 'auto',
      zIndex: 10000,
      backgroundColor: 'hsl(var(--popover))',
      color: 'hsl(var(--popover-foreground))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      padding: '4px 0',
    });
  }, []);

  const commitAndClose = useCallback(
    (nextValues: string[], persist: boolean) => {
      if (committedRef.current) {
        return;
      }
      committedRef.current = true;
      if (persist) {
        save(nextValues, true);
      }
      close(false);
    },
    [close, save],
  );

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useLayoutEffect(() => {
    updatePopupPosition();
  }, [updatePopupPosition, enumValues.length]);

  useEffect(() => {
    const handleViewportChange = () => {
      updatePopupPosition();
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [updatePopupPosition]);

  useEffect(() => {
    popupRef.current?.focus();
  }, [popupStyle]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      const popup = popupRef.current;
      const anchor = anchorRef.current;
      if (!popup || !anchor) {
        return;
      }
      if (target && (popup.contains(target) || anchor.contains(target))) {
        return;
      }

      commitAndClose(selectedRef.current, true);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [commitAndClose]);

  const toggle = (val: string) => {
    setSelected((prev) => {
      const next = prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val];
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitAndClose(selectedRef.current, true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      commitAndClose(selectedRef.current, false);
    }
  };

  const popup = popupStyle ? (
    <div
      ref={popupRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      className="revogrid-multiselect-editor"
      style={popupStyle}
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
  ) : null;

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  return (
    <>
      <div ref={anchorRef} style={{ width: '100%', height: '100%' }} aria-hidden="true" />
      {portalTarget && popup ? createPortal(popup, portalTarget) : null}
    </>
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
export const sliderEditor = Editor(SliderEditorComponent);
export const textareaEditor = Editor(TextareaEditorComponent);
export const jsonEditor = Editor(JsonEditorComponent);
export const selectEditor = Editor(SelectEditorComponent);
export const dateEditor = Editor(DateEditorComponent);
export const colorEditor = Editor(ColorEditorComponent);
export const multiselectEditor = Editor(MultiselectEditorComponent);

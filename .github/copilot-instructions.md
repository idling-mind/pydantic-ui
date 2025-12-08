# AI Agent Coding Instructions

This document provides specific instructions for AI coding agents working on the pydantic-ui project.

---

## 🎯 Project Context

**pydantic-ui** is a Python package that provides a dynamic React-based UI for editing deeply nested Pydantic models. It consists of:

1. **Python Backend** (`pydantic_ui/`): FastAPI router with schema parsing and data handling
2. **React Frontend** (`frontend/`): Tree navigation + detail panel UI using **shadcn/ui** components (bundled with Python package)

### Public API

The package exports the following from `pydantic_ui/__init__.py`:
- `create_pydantic_ui` - Factory function to create a FastAPI router for a Pydantic model
- `UIConfig` - Global UI configuration class
- `FieldConfig` - Per-field UI configuration class  
- `Renderer` - Enum of available field renderers

### UI Framework Stack
- **shadcn/ui**: Primary component library (built on Radix UI primitives)
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library
- **class-variance-authority (CVA)**: Component variants
- **AG Grid**: Data table component for array/list editing with sorting, filtering, and inline editing

---

## 📋 General Coding Standards

### Python Code

```python
# Use Python 3.10+ features
from typing import Annotated, Literal, TypeAlias

# Always use type hints
def process_data(data: dict[str, Any], *, strict: bool = False) -> ProcessedData:
    """
    Process the input data.
    
    Args:
        data: The raw data dictionary
        strict: If True, raise on invalid fields
        
    Returns:
        Processed data object
        
    Raises:
        ValidationError: If data is invalid and strict=True
    """
    ...

# Prefer async for I/O operations
async def fetch_data(id: str) -> Data | None:
    ...

# Use Pydantic v2 syntax
from pydantic import BaseModel, Field, field_validator, model_validator

class MyModel(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return v.strip()
```

### TypeScript/React Code

```tsx
// Use interfaces for props
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

// Functional components with explicit typing
export function Button({ 
  label, 
  onClick, 
  variant = 'primary',
  disabled = false 
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-4 py-2 rounded-md font-medium transition-colors',
        variant === 'primary' && 'bg-blue-500 text-white hover:bg-blue-600',
        variant === 'secondary' && 'bg-gray-200 text-gray-800 hover:bg-gray-300',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {label}
    </button>
  );
}

// Use named exports
export { Button };

// Prefer const and arrow functions
const handleClick = () => {
  // ...
};

// Destructure props
const { value, onChange } = props;
```

### shadcn/ui + Tailwind CSS

```tsx
// ALWAYS prefer shadcn/ui components over custom implementations
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Use cn() helper from lib/utils for conditional classes
import { cn } from '@/lib/utils';

<div className={cn(
  'base-classes',
  condition && 'conditional-classes',
  anotherCondition ? 'true-classes' : 'false-classes'
)}>

// Use shadcn/ui CSS variables for theming (NOT hardcoded colors)
<p className="text-foreground">        // Primary text
<p className="text-muted-foreground">  // Secondary/muted text
<div className="bg-background">        // Page background
<div className="bg-card">              // Card background
<div className="bg-muted">             // Muted background
<div className="border-border">        // Border color
<div className="bg-primary text-primary-foreground">  // Primary button style
<div className="bg-destructive text-destructive-foreground">  // Destructive/error

// Button variants (use shadcn/ui variants, not custom)
<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>

// Form fields pattern
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="Enter email" />
</div>

// DO NOT create custom button/input/card components
// DO use shadcn/ui components and extend via className if needed
```

---

## 🏗️ Architecture Guidelines

### Backend Structure

```
pydantic_ui/
├── __init__.py          # Public exports: create_pydantic_ui, UIConfig, FieldConfig, Renderer
├── app.py               # Router factory (create_pydantic_ui) - serves API endpoints and static files
├── schema.py            # Schema parsing: parse_model, parse_field, model_to_data
├── config.py            # Configuration classes: UIConfig, FieldConfig, Renderer enum
├── models.py            # Internal Pydantic models
├── handlers.py          # DataHandler class for data operations
├── utils.py             # Helper functions
└── static/              # Built frontend assets (auto-generated)
    ├── index.html
    └── assets/
        ├── index-*.js
        └── index-*.css
```

**Key API Endpoints** (created by `create_pydantic_ui`):
- `GET /api/schema` - Get the model schema for UI rendering
- `GET /api/data` - Get current data
- `POST /api/data` - Update entire data
- `PATCH /api/data` - Partial update (path + value)
- `POST /api/validate` - Validate data without saving
- `GET /api/config` - Get UI configuration
- `GET /` - Serve the React UI
- `GET /assets/*` - Serve static assets

**Key Principles:**
- Keep `__init__.py` clean - only export public API
- One responsibility per module
- Use dependency injection for testability
- All route handlers should be async

### Frontend Structure

```
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── src/
    ├── main.tsx             # Entry point
    ├── App.tsx              # Root component with providers
    ├── api.ts               # API client (createApiClient)
    ├── types.ts             # Shared TypeScript types
    ├── index.css            # Tailwind CSS entry
    ├── components/
    │   ├── ui/              # shadcn/ui components (DO NOT MODIFY)
    │   │   ├── button.tsx
    │   │   ├── card.tsx
    │   │   ├── input.tsx
    │   │   ├── label.tsx
    │   │   ├── select.tsx
    │   │   ├── slider.tsx
    │   │   ├── switch.tsx
    │   │   ├── scroll-area.tsx
    │   │   ├── collapsible.tsx
    │   │   ├── context-menu.tsx
    │   │   ├── dialog.tsx
    │   │   ├── alert-dialog.tsx
    │   │   └── ...
    │   ├── Layout/
    │   │   └── index.tsx    # Main layout with tree + detail panels
    │   ├── Header/
    │   │   └── index.tsx    # App header with save/reset buttons
    │   ├── TreePanel/
    │   │   ├── index.tsx        # Tree navigation panel
    │   │   ├── TreeNode.tsx     # Individual tree node component
    │   │   ├── TreeNodeContextMenu.tsx  # Right-click context menu
    │   │   └── PasteSelectedDialog.tsx  # Multi-paste dialog
    │   ├── DetailPanel/
    │   │   ├── index.tsx        # Detail editing panel
    │   │   ├── ObjectEditor.tsx # Editor for objects and arrays
    │   │   └── NestedFieldCard.tsx  # Card for nested object/array navigation
    │   ├── TableView/
    │   │   └── index.tsx        # AG Grid table view for arrays (inline editing, sorting, color-coded numerics)
    │   └── Renderers/
    │       ├── index.tsx        # Renderer registry and FieldRenderer component
    │       ├── types.ts         # RendererProps interface
    │       ├── TextInput.tsx
    │       ├── TextareaInput.tsx
    │       ├── NumberInput.tsx
    │       ├── SliderInput.tsx
    │       ├── CheckboxInput.tsx
    │       ├── ToggleInput.tsx
    │       ├── SelectInput.tsx
    │       ├── DateInput.tsx
    │       ├── ColorInput.tsx
    │       └── JsonInput.tsx
    ├── context/
    │   ├── DataContext.tsx      # Main data state management
    │   ├── ThemeContext.tsx     # Theme (light/dark/system)
    │   └── ClipboardContext.tsx # Copy/paste functionality
    └── lib/
        ├── utils.ts             # cn() helper and utilities
        └── tableUtils.ts        # Schema flattening, path utilities for AG Grid TableView
```

**Key Principles:**
- **DO NOT modify** files in `components/ui/` - these are shadcn/ui components
- Use shadcn/ui components as building blocks in your custom components
- Co-locate related files in folders
- Index files for clean imports
- Hooks for reusable stateful logic
- Context for truly global state only

---

## 🔧 Implementation Patterns

### Available Renderers

The `Renderer` enum in `pydantic_ui/config.py` provides these renderer options:

```python
class Renderer(str, Enum):
    AUTO = "auto"              # Auto-detect based on type
    TEXT_INPUT = "text_input"  # Single-line text
    TEXT_AREA = "text_area"    # Multi-line text
    NUMBER_INPUT = "number_input"  # Number input
    SLIDER = "slider"          # Range slider (requires min/max)
    CHECKBOX = "checkbox"      # Checkbox
    TOGGLE = "toggle"          # Toggle switch
    SELECT = "select"          # Dropdown select
    MULTI_SELECT = "multi_select"  # Multi-select
    DATE_PICKER = "date_picker"    # Date picker
    DATETIME_PICKER = "datetime_picker"  # DateTime picker
    COLOR_PICKER = "color_picker"  # Color picker
    FILE_UPLOAD = "file_upload"    # File upload
    PASSWORD = "password"      # Password input
    EMAIL = "email"            # Email input
    URL = "url"                # URL input
```

### Schema Parsing

The schema parsing in `pydantic_ui/schema.py` handles:

```python
# pydantic_ui/schema.py

from pydantic import BaseModel
from pydantic.fields import FieldInfo
from typing import Any, get_args, get_origin

def parse_model(model: type[BaseModel]) -> dict[str, Any]:
    """Convert Pydantic model to UI schema format."""
    schema = {
        "name": model.__name__,
        "type": "object",
        "fields": {}
    }
    
    for field_name, field_info in model.model_fields.items():
        schema["fields"][field_name] = parse_field(
            field_name, 
            field_info,
            field_info.annotation
        )
    
    return schema

def parse_field(
    name: str, 
    field_info: FieldInfo, 
    field_type: type
) -> dict[str, Any]:
    """Parse a single field to schema format."""
    origin = get_origin(field_type)
    args = get_args(field_type)
    
    # Handle Optional (Union with None)
    if origin is Union:
        non_none = [a for a in args if a is not type(None)]
        if len(non_none) == 1:
            return {
                **parse_field(name, field_info, non_none[0]),
                "required": False
            }
    
    # Handle List/Set
    if origin in (list, set):
        return {
            "type": "array",
            "items": parse_field("item", FieldInfo(), args[0]) if args else {}
        }
    
    # Handle nested models
    if isinstance(field_type, type) and issubclass(field_type, BaseModel):
        return parse_model(field_type)
    
    # Primitive types
    return {
        "type": get_json_type(field_type),
        "title": field_info.title or name.replace("_", " ").title(),
        "description": field_info.description,
        "default": field_info.default if field_info.default is not PydanticUndefined else None,
    }
```

**Supported Types:**
- Primitives: `str`, `int`, `float`, `bool`
- DateTime: `datetime`, `date`, `time`
- Collections: `list`, `set`, `tuple`, `dict`
- Enums: `Enum`, `StrEnum`
- Literals: `Literal["a", "b", "c"]`
- Optional: `Optional[T]` or `T | None`
- Nested models: `BaseModel` subclasses
- Annotated types with `FieldConfig`

### Tree Component Pattern (with shadcn/ui)

```tsx
// components/TreePanel/TreeNode.tsx
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface TreeNodeProps {
  name: string;
  schema: SchemaNode;
  path: string;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
}

export function TreeNode({
  name,
  schema,
  path,
  depth,
  isSelected,
  isExpanded,
  onSelect,
  onToggle,
}: TreeNodeProps) {
  const isExpandable = schema.type === 'object' || schema.type === 'array';
  
  const handleClick = () => {
    onSelect(path);
  };

  const getIcon = () => {
    if (schema.type === 'object') {
      return isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />;
    }
    if (schema.type === 'array') {
      return <FileText className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  const nodeContent = (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md',
        'hover:bg-accent hover:text-accent-foreground',
        'transition-colors',
        isSelected && 'bg-accent text-accent-foreground'
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={handleClick}
    >
      {isExpandable ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(path);
          }}
          className="p-0.5 hover:bg-muted rounded"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      ) : (
        <span className="w-5" />
      )}
      {getIcon()}
      <span className="text-sm truncate">{name}</span>
      <span className="text-xs text-muted-foreground">({schema.type})</span>
    </div>
  );

  if (!isExpandable) {
    return nodeContent;
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={() => onToggle(path)}>
      <CollapsibleTrigger asChild>
        {nodeContent}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Render children */}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### Field Renderer Pattern (with shadcn/ui)

The renderer system in `frontend/src/components/Renderers/` auto-selects renderers based on schema type:

```tsx
// components/Renderers/index.tsx

// Registry of renderers
const rendererMap: Record<string, React.ComponentType<RendererProps>> = {
  text: TextInput,
  text_input: TextInput,
  textarea: TextareaInput,
  text_area: TextareaInput,
  number: NumberInput,
  number_input: NumberInput,
  slider: SliderInput,
  checkbox: CheckboxInput,
  toggle: ToggleInput,
  select: SelectInput,
  date: DateInput,
  date_picker: DateInput,
  datetime: DateInput,
  datetime_picker: DateInput,
  color: ColorInput,
  color_picker: ColorInput,
  json: JsonInput,
};

// Determine the best renderer based on schema
function getDefaultRenderer(schema: SchemaField): string {
  // Check for explicit renderer in ui_config
  if (schema.ui_config?.renderer) {
    return schema.ui_config.renderer;
  }

  // Check for enum/literal - use select
  if (schema.enum || schema.literal_values) {
    return 'select';
  }

  // Type-based defaults
  switch (schema.type) {
    case 'string':
      if (schema.format === 'date') return 'date';
      if (schema.format === 'date-time') return 'datetime';
      if (schema.format === 'color') return 'color';
      if (schema.max_length && schema.max_length > 200) return 'textarea';
      return 'text';

    case 'integer':
    case 'number':
      // Use slider if min/max are defined
      if (schema.minimum !== undefined && schema.maximum !== undefined) {
        return 'slider';
      }
      return 'number';

    case 'boolean':
      return 'toggle';

    case 'object':
    case 'array':
      if (!schema.fields && !schema.items) return 'json';
      return schema.type;

    default:
      return 'json';
  }
}
```

### RendererProps Interface

```tsx
// components/Renderers/types.ts
export interface RendererProps {
  name: string;
  path: string;
  schema: SchemaField;
  value: unknown;
  onChange: (value: unknown) => void;
  errors?: FieldError[];
  disabled?: boolean;
}
```

### DataContext Pattern

The main state management is in `frontend/src/context/DataContext.tsx`:

```tsx
// context/DataContext.tsx

interface DataContextValue {
  schema: Schema | null;
  config: UIConfig | null;
  data: Record<string, unknown>;
  errors: FieldError[];
  loading: boolean;
  dirty: boolean;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  setSelectedPath: (path: string | null) => void;
  toggleExpanded: (path: string) => void;
  expandPath: (path: string) => void;
  updateValue: (path: string, value: unknown) => void;
  saveData: () => Promise<boolean>;
  resetData: () => void;
  refresh: () => Promise<void>;
  getErrorCountForPath: (path: string) => number;
  errorCountByPath: Map<string, number>;
}
```

**Key Features:**
- Path-based navigation with `selectedPath` and `expandedPaths`
- Array index support in paths: `users[0].name`
- Local state updates until explicit `saveData()` call
- Error normalization from backend format to frontend format
- Error counting per path (including parent path aggregation)

### TableView Component (AG Grid)

The TableView component in `frontend/src/components/TableView/` displays array data in a tabular format with AG Grid:

```tsx
// components/TableView/index.tsx
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { flattenSchema, arrayToFlatRows, generateColumnDefs } from '@/lib/tableUtils';

interface TableViewProps {
  name: string;
  path: string;
  schema: SchemaField;          // Array schema with items
  value: unknown[] | null;      // Array data
  errors?: FieldError[];
  disabled?: boolean;
  onChange: (value: unknown) => void;
}
```

**Key Features:**
- **Multi-level column headers**: Nested object fields are organized into hierarchical column groups (e.g., `user` → `name`, `address` → `city`, `street`)
- **Inline editing**: Click cells to edit values directly
- **Sorting & filtering**: Built-in AG Grid functionality
- **Color-coded numerics**: Numeric columns show value-based background colors (blue-white-red gradient)
- **Row operations**: Add, delete, duplicate, and drag-to-reorder rows
- **Theme integration**: Uses shadcn/ui CSS variables for consistent styling

**Table Utilities** (`lib/tableUtils.ts`):
```tsx
// Flatten nested schema to column definitions
flattenSchema(schema: SchemaField, prefix: string, maxDepth: number): FlattenedField[]

// Convert nested objects to flat row format
arrayToFlatRows(data: unknown[], fields: FlattenedField[]): FlatRow[]

// Generate AG Grid column definitions with type-specific editors
generateColumnDefs(fields: FlattenedField[], rowData: FlatRow[]): ColDef[]

// Get/set values by dot-notation path
getValueByPath(obj: unknown, path: string): unknown
setValueByPath(obj: unknown, path: string, value: unknown): unknown

// Color calculations for numeric columns
getColorForValue(value: number, min: number, max: number, scale: string): string
```

**Usage in ArrayListEditor**:
The ArrayListEditor component (in `ObjectEditor.tsx`) provides a toggle between list view and table view for arrays containing objects:

```tsx
// Toggle between list and table views
const [viewMode, setViewMode] = useState<'list' | 'table'>('list');

{viewMode === 'table' ? (
  <TableView
    name={path}
    path={path}
    schema={schema}
    value={items}
    onChange={onChange}
  />
) : (
  // List view with cards
)}
```

---

## 🎨 shadcn/ui Setup & Usage

### Initial Setup (already done)

```bash
# Initialize shadcn/ui in the frontend project
npx shadcn-ui@latest init

# Install components as needed
npx shadcn-ui@latest add button card input label select slider switch textarea
npx shadcn-ui@latest add collapsible scroll-area separator tabs toast tooltip
npx shadcn-ui@latest add dialog dropdown-menu popover command
```

### Required shadcn/ui Components

| Component | Usage |
|-----------|-------|
| `button` | Actions, form submission |
| `card` | Nested object/array cards |
| `input` | Text input fields |
| `label` | Field labels |
| `select` | Dropdown selections |
| `slider` | Numeric range inputs |
| `switch` | Boolean toggles |
| `textarea` | Multi-line text |
| `collapsible` | Tree expand/collapse |
| `scroll-area` | Scrollable panels |
| `separator` | Visual dividers |
| `tabs` | Tab navigation (if needed) |
| `toast` | Notifications |
| `tooltip` | Help tooltips |
| `dialog` | Modal dialogs |
| `dropdown-menu` | Context menus |

### Component Import Pattern

```tsx
// Always use the @/ path alias for imports
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// NEVER import from relative paths for ui components
// ❌ import { Button } from '../ui/button';
// ✅ import { Button } from '@/components/ui/button';
```

### Theme Toggle Component (shadcn/ui style)

```tsx
// components/Header/ThemeToggle.tsx
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/context/ThemeContext';

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### NestedCard Component Example

```tsx
// components/DetailPanel/NestedCard.tsx
import { ChevronRight, Folder, List } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NestedCardProps {
  name: string;
  type: 'object' | 'array';
  itemCount?: number;
  fieldCount?: number;
  onClick: () => void;
}

export function NestedCard({ 
  name, 
  type, 
  itemCount, 
  fieldCount, 
  onClick 
}: NestedCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all',
        'hover:border-primary hover:shadow-md'
      )}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex-shrink-0">
          {type === 'object' ? (
            <Folder className="h-5 w-5 text-primary" />
          ) : (
            <List className="h-5 w-5 text-green-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{name}</h3>
          <p className="text-sm text-muted-foreground">
            {type === 'object' 
              ? `${fieldCount} fields` 
              : `${itemCount} items`}
          </p>
        </div>
        <Badge variant="secondary">{type}</Badge>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
```

---

## ⚠️ Common Pitfalls to Avoid

### Python

```python
# ❌ Don't use mutable default arguments
def bad_func(items: list = []):
    items.append(1)
    return items

# ✅ Use None and create new instance
def good_func(items: list | None = None):
    if items is None:
        items = []
    items.append(1)
    return items

# ❌ Don't catch broad exceptions
try:
    data = process()
except Exception:
    pass

# ✅ Catch specific exceptions
try:
    data = process()
except ValidationError as e:
    logger.warning(f"Validation failed: {e}")
    raise HTTPException(400, str(e))

# ❌ Don't use sync operations in async context
async def bad_handler():
    with open('file.txt') as f:  # Blocks event loop!
        return f.read()

# ✅ Use async file operations or run in executor
async def good_handler():
    async with aiofiles.open('file.txt') as f:
        return await f.read()
```

### React/TypeScript

```tsx
// ❌ Don't mutate state directly
const [items, setItems] = useState([1, 2, 3]);
items.push(4); // Wrong!
setItems(items); // Won't trigger re-render

// ✅ Create new array/object
setItems([...items, 4]);

// ❌ Don't use index as key for dynamic lists
{items.map((item, index) => (
  <Item key={index} {...item} />  // Wrong if items can reorder!
))}

// ✅ Use stable unique identifier
{items.map((item) => (
  <Item key={item.id} {...item} />
))}

// ❌ Don't define components inside components
function Parent() {
  // This creates new component on every render!
  function Child() {
    return <div>Child</div>;
  }
  return <Child />;
}

// ✅ Define components outside or use useMemo
const Child = memo(() => <div>Child</div>);
function Parent() {
  return <Child />;
}

// ❌ Don't forget cleanup in useEffect
useEffect(() => {
  const handler = () => console.log('resize');
  window.addEventListener('resize', handler);
  // Missing cleanup!
}, []);

// ✅ Always return cleanup function
useEffect(() => {
  const handler = () => console.log('resize');
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);
```

---

## 🧪 Testing Guidelines

### Backend Tests

```python
# tests/test_schema.py
import pytest
from pydantic import BaseModel
from pydantic_ui.schema import parse_model

class SimpleModel(BaseModel):
    name: str
    age: int

def test_parse_simple_model():
    schema = parse_model(SimpleModel)
    
    assert schema["name"] == "SimpleModel"
    assert schema["type"] == "object"
    assert "name" in schema["fields"]
    assert schema["fields"]["name"]["type"] == "string"
    assert schema["fields"]["age"]["type"] == "integer"

@pytest.mark.parametrize("field_type,expected_type", [
    (str, "string"),
    (int, "integer"),
    (float, "number"),
    (bool, "boolean"),
])
def test_primitive_types(field_type, expected_type):
    # Dynamic model creation for testing
    ...

# tests/test_handlers.py
import pytest
from httpx import AsyncClient
from pydantic_ui import create_pydantic_ui

@pytest.fixture
def app():
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(create_pydantic_ui(SimpleModel))
    return app

@pytest.mark.asyncio
async def test_get_schema(app):
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/schema")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "fields" in data
```

### Frontend Tests

```tsx
// components/TreePanel/TreeNode.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { TreeNode } from './TreeNode';

const mockSchema = {
  type: 'object',
  fields: {
    name: { type: 'string' },
    age: { type: 'number' },
  },
};

describe('TreeNode', () => {
  it('renders node name', () => {
    render(
      <TreeNode
        name="person"
        schema={mockSchema}
        path="root.person"
        depth={0}
        isSelected={false}
        isExpanded={false}
        onSelect={jest.fn()}
        onToggle={jest.fn()}
      />
    );
    
    expect(screen.getByText('person')).toBeInTheDocument();
  });
  
  it('calls onSelect when clicked', () => {
    const onSelect = jest.fn();
    render(
      <TreeNode
        name="person"
        schema={mockSchema}
        path="root.person"
        depth={0}
        isSelected={false}
        isExpanded={false}
        onSelect={onSelect}
        onToggle={jest.fn()}
      />
    );
    
    fireEvent.click(screen.getByText('person'));
    expect(onSelect).toHaveBeenCalledWith('root.person');
  });
  
  it('shows children when expanded', () => {
    render(
      <TreeNode
        name="person"
        schema={mockSchema}
        path="root.person"
        depth={0}
        isSelected={false}
        isExpanded={true}
        onSelect={jest.fn()}
        onToggle={jest.fn()}
      />
    );
    
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('age')).toBeInTheDocument();
  });
});
```

---

## 📦 Build & Deploy

### Development Testing with build-test.ps1

The primary script for building and testing the full application is `./scripts/build-test.ps1`. This script builds the React frontend, copies it to the static folder, and starts a dev server.

**Usage:**

```powershell
# Full build and run with defaults (main.py example on port 8000)
./scripts/build-test.ps1

# Skip frontend build (use existing build)
./scripts/build-test.ps1 -SkipBuild

# Skip npm install (faster if node_modules exists)
./scripts/build-test.ps1 -SkipNpmInstall

# Run the simple.py example instead of main.py
./scripts/build-test.ps1 -Example simple

# Run on a different port
./scripts/build-test.ps1 -Port 3000

# Automatically open browser after server starts
./scripts/build-test.ps1 -OpenBrowser

# Combine options for fast iteration
./scripts/build-test.ps1 -SkipBuild -SkipNpmInstall -Example simple -Port 3000 -OpenBrowser
```

**Parameters:**
| Parameter | Description | Default |
|-----------|-------------|---------|
| `-SkipBuild` | Skip the frontend build step (use existing build) | `$false` |
| `-SkipNpmInstall` | Skip npm install step | `$false` |
| `-Port` | Port to run the dev server on | `8000` |
| `-Example` | Which example to run: 'main' or 'simple' | `'main'` |
| `-OpenBrowser` | Automatically open the browser after starting | `$false` |

**What the script does:**
1. Builds the React frontend (unless `-SkipBuild`)
2. Copies built files to `pydantic_ui/static/`
3. Runs the selected example from `examples/basic/`
4. Opens browser to `http://localhost:<port>/config`

### Building Frontend for Python Package

```bash
# In frontend directory
npm run build

# Copy to Python package
cp -r dist/* ../pydantic_ui/static/
```

Or use the copy script directly:

```bash
# From project root
node scripts/copy-to-package.js
```

### Build Script (package.json)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "build:package": "npm run build && node scripts/copy-to-package.js",
    "preview": "vite preview",
    "test": "vitest",
    "lint": "eslint src --ext ts,tsx"
  }
}
```

### Vite Config for Bundling (with shadcn/ui path aliases)

```ts
// vite.config.ts
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Relative paths for embedding
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Single bundle for easy embedding
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
```

### tsconfig.json (path aliases)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### tailwind.config.js (shadcn/ui compatible)

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

---

## 🔍 Debugging Tips

1. **Schema Issues**: Log the output of `parse_model()` to see the generated schema
2. **Path Issues**: Add console logs in `handleSelect` and `handleNavigate` to trace paths
3. **Theme Issues**: Check if `dark` class is applied to `<html>` element
4. **API Issues**: Use browser DevTools Network tab to inspect requests/responses
5. **State Issues**: Use React DevTools to inspect component state

---

## 📝 Checklist Before Submitting Code

- [ ] Code follows the style guidelines
- [ ] All functions have type hints
- [ ] Public functions have docstrings
- [ ] No console.log or print statements (except for debugging)
- [ ] Tests pass locally
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No lint errors (`npm run lint` / `ruff check`)
- [ ] UI works in both light and dark mode
- [ ] UI is responsive (test at different widths)
- [ ] Keyboard navigation works
- [ ] Error states are handled gracefully

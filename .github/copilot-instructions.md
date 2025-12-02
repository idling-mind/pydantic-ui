# AI Agent Coding Instructions

This document provides specific instructions for AI coding agents working on the pydantic-ui project.

---

## 🎯 Project Context

**pydantic-ui** is a Python package that provides a dynamic React-based UI for editing deeply nested Pydantic models. It consists of:

1. **Python Backend**: FastAPI router with schema parsing and data handling
2. **React Frontend**: Tree navigation + detail panel UI using **shadcn/ui** components (bundled with Python package)

### UI Framework Stack
- **shadcn/ui**: Primary component library (built on Radix UI primitives)
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library
- **class-variance-authority (CVA)**: Component variants

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
├── __init__.py          # Public exports only
├── app.py               # Router factory - keep thin
├── schema.py            # Schema parsing logic
├── config.py            # Configuration classes
├── models.py            # Internal Pydantic models
├── handlers.py          # Route handlers
└── utils.py             # Helper functions
```

**Key Principles:**
- Keep `__init__.py` clean - only export public API
- One responsibility per module
- Use dependency injection for testability
- All route handlers should be async

### Frontend Structure

```
src/
├── components/          # React components
│   ├── ui/             # shadcn/ui components (DO NOT MODIFY)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── select.tsx
│   │   ├── slider.tsx
│   │   ├── switch.tsx
│   │   └── ...
│   ├── Layout.tsx       # Main layout
│   ├── TreePanel/       # Tree navigation
│   │   ├── index.tsx
│   │   └── TreeNode.tsx
│   ├── DetailPanel/     # Detail editing panel
│   │   ├── index.tsx
│   │   ├── FieldEditor.tsx
│   │   └── NestedCard.tsx
│   └── Header/
│       ├── index.tsx
│       └── ThemeToggle.tsx
├── renderers/           # Field renderers (use shadcn/ui internally)
├── hooks/               # Custom hooks
├── context/             # React contexts
├── lib/
│   └── utils.ts        # cn() helper and utilities
├── types.ts             # Shared TypeScript types
└── api.ts               # API client
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

### Schema Parsing

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

```tsx
// renderers/index.tsx
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface RendererProps {
  value: unknown;
  onChange: (value: unknown) => void;
  schema: FieldSchema;
  config?: FieldConfig;
  error?: string;
  disabled?: boolean;
}

// Example: Text Input Renderer
export function TextInputRenderer({
  value,
  onChange,
  schema,
  config,
  error,
  disabled,
}: RendererProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={schema.name}>
        {config?.label || schema.title}
        {schema.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={schema.name}
        type="text"
        value={(value as string) || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={config?.placeholder}
        disabled={disabled}
        className={cn(error && 'border-destructive')}
      />
      {config?.help_text && (
        <p className="text-sm text-muted-foreground">{config.help_text}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

// Example: Slider Renderer
export function SliderRenderer({
  value,
  onChange,
  schema,
  config,
  error,
  disabled,
}: RendererProps) {
  const min = config?.props?.min ?? schema.constraints?.min ?? 0;
  const max = config?.props?.max ?? schema.constraints?.max ?? 100;
  const step = config?.props?.step ?? 1;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{config?.label || schema.title}</Label>
        <span className="text-sm text-muted-foreground">{value as number}</span>
      </div>
      <Slider
        value={[value as number]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
    </div>
  );
}

// Example: Switch/Toggle Renderer
export function ToggleRenderer({
  value,
  onChange,
  schema,
  config,
  disabled,
}: RendererProps) {
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={schema.name}>{config?.label || schema.title}</Label>
      <Switch
        id={schema.name}
        checked={value as boolean}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

// Renderer registry
const renderers: Record<string, React.ComponentType<RendererProps>> = {
  text_input: TextInputRenderer,
  slider: SliderRenderer,
  toggle: ToggleRenderer,
  // ... more renderers
};

export function getRenderer(type: string): React.ComponentType<RendererProps> {
  return renderers[type] || TextInputRenderer;
}
```

### Theme Context Pattern

```tsx
// context/ThemeContext.tsx

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme');
    return (stored as Theme) || 'system';
  });
  
  const resolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches 
        ? 'dark' 
        : 'light';
    }
    return theme;
  }, [theme]);
  
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolvedTheme);
  }, [theme, resolvedTheme]);
  
  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setTheme('system'); // Trigger re-render
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);
  
  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
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

### Building Frontend for Python Package

```bash
# In frontend directory
npm run build

# Copy to Python package
cp -r dist/* ../pydantic_ui/static/
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

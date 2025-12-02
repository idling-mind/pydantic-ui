# Pydantic UI - Project Plan

A reusable FastAPI-based package for rendering dynamic UIs for deeply nested Pydantic models with a tree navigation sidebar and customizable field renderers.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Directory Structure](#directory-structure)
4. [Core Components](#core-components)
5. [Implementation Phases](#implementation-phases)
6. [Technical Specifications](#technical-specifications)
7. [AI Agent Instructions](#ai-agent-instructions)
8. [API Reference](#api-reference)
9. [Usage Examples](#usage-examples)

---

## Project Overview

### Goals

- Create a reusable Python package (`pydantic-ui`) that can be easily imported into FastAPI projects
- Provide a dynamic UI for editing deeply nested Pydantic models
- Support customizable UI components per field (input, slider, dropdown, etc.)
- Modern, clean UI with light/dark mode support
- Tree-based navigation for nested structures
- Type-safe with full Pydantic v2 support

### Key Features

1. **Tree Navigation Panel**: Sidebar showing hierarchical structure of Pydantic models
2. **Dynamic Field Rendering**: Auto-generate appropriate input components based on field types
3. **Custom UI Configuration**: Override default renderers with custom components per field
4. **Array/List Support**: Add, remove, reorder items in list fields
5. **Validation**: Real-time validation using Pydantic validators
6. **Theme Support**: Light and dark mode with system preference detection
7. **FastAPI Integration**: Easy mounting as a sub-application or router

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Host FastAPI App                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    pydantic-ui Package                     │   │
│  │                                                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │   FastAPI   │  │   Schema    │  │   UI Config     │   │   │
│  │  │   Router    │  │   Parser    │  │   Registry      │   │   │
│  │  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘   │   │
│  │         │                │                   │            │   │
│  │         └────────────────┼───────────────────┘            │   │
│  │                          │                                │   │
│  │  ┌───────────────────────┴───────────────────────────┐   │   │
│  │  │              React Frontend (Bundled)              │   │   │
│  │  │                                                    │   │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │   │   │
│  │  │  │  Tree    │  │  Detail  │  │  Field       │    │   │   │
│  │  │  │  Panel   │  │  Panel   │  │  Renderers   │    │   │   │
│  │  │  └──────────┘  └──────────┘  └──────────────┘    │   │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User defines Pydantic model + UI config
2. Backend parses model schema (JSON Schema)
3. Frontend receives schema + config + data
4. User edits data in UI
5. Changes sent to backend for validation
6. Validated data returned/stored
```

---

## Directory Structure

```
pydantic-ui/
├── pyproject.toml                 # Package configuration
├── README.md                      # Documentation
├── LICENSE                        # MIT License
├── PROJECT_PLAN.md               # This file
│
├── pydantic_ui/                   # Python package
│   ├── __init__.py               # Package exports
│   ├── app.py                    # FastAPI app/router factory
│   ├── schema.py                 # Pydantic schema parser
│   ├── config.py                 # UI configuration classes
│   ├── registry.py               # Field renderer registry
│   ├── handlers.py               # API route handlers
│   ├── models.py                 # Internal Pydantic models
│   ├── utils.py                  # Utility functions
│   │
│   ├── static/                   # Built frontend assets
│   │   ├── index.html
│   │   ├── assets/
│   │   │   ├── index.js
│   │   │   └── index.css
│   │   └── favicon.ico
│   │
│   └── renderers/                # Built-in field renderers
│       ├── __init__.py
│       ├── base.py               # Base renderer config
│       ├── string.py             # String field renderers
│       ├── number.py             # Number field renderers
│       ├── boolean.py            # Boolean field renderers
│       └── complex.py            # Object/Array renderers
│
├── frontend/                      # React frontend source
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   │
│   └── src/
│       ├── main.tsx              # Entry point
│       ├── App.tsx               # Main application
│       ├── index.css             # Global styles
│       ├── types.ts              # TypeScript types
│       ├── api.ts                # API client
│       ├── context/
│       │   ├── ThemeContext.tsx  # Theme provider
│       │   └── DataContext.tsx   # Data state provider
│       │
│       ├── components/
│       │   ├── Layout.tsx        # Main layout
│       │   ├── TreePanel/
│       │   │   ├── index.tsx
│       │   │   ├── TreeNode.tsx
│       │   │   └── TreeNode.css
│       │   ├── DetailPanel/
│       │   │   ├── index.tsx
│       │   │   ├── FieldEditor.tsx
│       │   │   └── NestedCard.tsx
│       │   ├── Header/
│       │   │   ├── index.tsx
│       │   │   └── ThemeToggle.tsx
│       │   └── ui/                 # shadcn/ui components
│       │       ├── accordion.tsx
│       │       ├── badge.tsx
│       │       ├── button.tsx
│       │       ├── card.tsx
│       │       ├── checkbox.tsx
│       │       ├── collapsible.tsx
│       │       ├── command.tsx
│       │       ├── dialog.tsx
│       │       ├── dropdown-menu.tsx
│       │       ├── input.tsx
│       │       ├── label.tsx
│       │       ├── popover.tsx
│       │       ├── scroll-area.tsx
│       │       ├── select.tsx
│       │       ├── separator.tsx
│       │       ├── slider.tsx
│       │       ├── switch.tsx
│       │       ├── tabs.tsx
│       │       ├── textarea.tsx
│       │       ├── toast.tsx
│       │       ├── toaster.tsx
│       │       └── tooltip.tsx
│       │
│       ├── renderers/            # Field renderer components
│       │   ├── index.tsx         # Renderer registry
│       │   ├── TextInput.tsx
│       │   ├── NumberInput.tsx
│       │   ├── Slider.tsx
│       │   ├── Checkbox.tsx
│       │   ├── Toggle.tsx
│       │   ├── Select.tsx
│       │   ├── MultiSelect.tsx
│       │   ├── TextArea.tsx
│       │   ├── DatePicker.tsx
│       │   ├── ColorPicker.tsx
│       │   └── FileUpload.tsx
│       │
│       ├── hooks/
│       │   ├── useSchema.ts
│       │   ├── useData.ts
│       │   ├── useTheme.ts
│       │   └── useDebounce.ts
│       │
│       └── utils/
│           ├── path.ts           # Path manipulation
│           ├── schema.ts         # Schema utilities
│           └── validation.ts     # Client-side validation
│
├── examples/                      # Example implementations
│   ├── basic/
│   │   └── main.py
│   ├── custom_renderers/
│   │   └── main.py
│   └── complex_models/
│       └── main.py
│
└── tests/
    ├── conftest.py
    ├── test_schema.py
    ├── test_config.py
    ├── test_handlers.py
    └── test_integration.py
```

---

## Core Components

### 1. Schema Parser (`pydantic_ui/schema.py`)

Converts Pydantic models to a UI-friendly schema format.

```python
# Output format
{
    "name": "ModelName",
    "type": "object",
    "description": "Model description",
    "fields": {
        "field_name": {
            "type": "string|number|boolean|object|array",
            "title": "Field Title",
            "description": "Field description",
            "required": True,
            "default": "default_value",
            "constraints": {
                "min": 0,
                "max": 100,
                "pattern": "regex",
                "enum": ["option1", "option2"]
            },
            "ui_config": {
                "renderer": "slider",
                "props": {"step": 1}
            },
            "fields": {...},  # For nested objects
            "items": {...}    # For arrays
        }
    }
}
```

### 2. UI Configuration (`pydantic_ui/config.py`)

```python
from pydantic_ui import UIConfig, FieldConfig, Renderer

class UIConfig:
    """Global UI configuration"""
    title: str = "Data Editor"
    description: str = ""
    theme: Literal["light", "dark", "system"] = "system"
    read_only: bool = False
    show_validation: bool = True
    auto_save: bool = False
    auto_save_delay: int = 1000  # ms

class FieldConfig:
    """Per-field UI configuration"""
    renderer: str = "auto"  # auto-detect based on type
    label: str | None = None
    placeholder: str | None = None
    help_text: str | None = None
    hidden: bool = False
    read_only: bool = False
    props: dict = {}  # Renderer-specific props

# Built-in renderers
class Renderer(str, Enum):
    AUTO = "auto"
    TEXT_INPUT = "text_input"
    TEXT_AREA = "text_area"
    NUMBER_INPUT = "number_input"
    SLIDER = "slider"
    CHECKBOX = "checkbox"
    TOGGLE = "toggle"
    SELECT = "select"
    MULTI_SELECT = "multi_select"
    DATE_PICKER = "date_picker"
    DATE_TIME_PICKER = "datetime_picker"
    COLOR_PICKER = "color_picker"
    FILE_UPLOAD = "file_upload"
    PASSWORD = "password"
    EMAIL = "email"
    URL = "url"
```

### 3. FastAPI Router (`pydantic_ui/app.py`)

```python
from pydantic_ui import create_pydantic_ui

# Creates a FastAPI router with all necessary endpoints
router = create_pydantic_ui(
    model=MyPydanticModel,
    ui_config=UIConfig(...),
    field_configs={
        "age": FieldConfig(renderer="slider", props={"min": 0, "max": 120}),
        "bio": FieldConfig(renderer="text_area", props={"rows": 5}),
    },
    data_loader=async_data_loader_func,  # Optional
    data_saver=async_data_saver_func,    # Optional
    prefix="/editor"
)

app.include_router(router)
```

### 4. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Serve the React SPA |
| GET | `/api/schema` | Get parsed schema with UI config |
| GET | `/api/data` | Get current data |
| POST | `/api/data` | Update data (full replacement) |
| PATCH | `/api/data` | Partial update |
| POST | `/api/validate` | Validate data without saving |
| GET | `/api/config` | Get UI configuration |

---

## Implementation Phases

### Phase 1: Core Backend (Python Package)

**Duration**: 2-3 days

#### Tasks:

1. **Project Setup**
   - Initialize `pyproject.toml` with dependencies
   - Set up package structure
   - Configure development tools (ruff, mypy, pytest)

2. **Schema Parser**
   - Parse Pydantic v2 models to JSON Schema
   - Handle nested models, Optional, Union types
   - Support `Annotated` types with metadata
   - Handle List, Dict, Set types

3. **Configuration System**
   - Implement `UIConfig` and `FieldConfig` classes
   - Create renderer registry
   - Support config via model Field metadata

4. **FastAPI Router**
   - Create router factory function
   - Implement API endpoints
   - Add static file serving
   - CORS configuration

5. **Data Handlers**
   - Data loading/saving hooks
   - Validation endpoint
   - Path-based partial updates

### Phase 2: React Frontend Foundation

**Duration**: 2-3 days

#### Tasks:

1. **Project Setup**
   - Initialize Vite + React + TypeScript
   - Configure Tailwind CSS with shadcn/ui
   - Initialize shadcn/ui (`npx shadcn-ui@latest init`)
   - Install required shadcn/ui components
   - Set up build for embedding in Python package

2. **Theme System**
   - Implement ThemeContext
   - Light/dark mode toggle
   - System preference detection
   - CSS custom properties for theming

3. **Layout Components**
   - Main layout with resizable panels
   - Header with title and controls
   - Responsive design

4. **Tree Panel**
   - Recursive tree rendering
   - Expand/collapse functionality
   - Selection highlighting
   - Icons for different types
   - Search/filter (optional)

5. **Detail Panel**
   - Display selected node details
   - Breadcrumb navigation
   - Section grouping (primitives vs nested)

### Phase 3: Field Renderers

**Duration**: 2-3 days

#### Tasks:

1. **Renderer Infrastructure**
   - Create renderer registry
   - Auto-detection logic
   - Props passing system

2. **Basic Renderers**
   - TextInput (with variants: email, url, password)
   - NumberInput
   - Checkbox
   - Toggle
   - Select (single)

3. **Advanced Renderers**
   - Slider (with range support)
   - TextArea
   - MultiSelect
   - DatePicker / DateTimePicker
   - ColorPicker

4. **Array Handling**
   - Add/remove items
   - Item reordering (drag & drop optional)
   - Empty state handling

### Phase 4: Integration & Polish

**Duration**: 1-2 days

#### Tasks:

1. **API Integration**
   - Fetch schema on load
   - Data loading/saving
   - Optimistic updates
   - Error handling

2. **Validation UI**
   - Display validation errors
   - Real-time validation
   - Field-level error messages

3. **Build Integration**
   - Build script to copy frontend to package
   - Version synchronization
   - Asset hashing

4. **Documentation & Examples**
   - README with quick start
   - API documentation
   - Example projects

### Phase 5: Testing & Release

**Duration**: 1-2 days

#### Tasks:

1. **Backend Tests**
   - Schema parser tests
   - Config tests
   - API endpoint tests

2. **Frontend Tests**
   - Component tests
   - Integration tests

3. **Release**
   - PyPI package
   - npm package (optional, for custom builds)

---

## Technical Specifications

### Python Requirements

```toml
[project]
requires-python = ">=3.10"
dependencies = [
    "fastapi>=0.100.0",
    "pydantic>=2.0.0",
    "uvicorn>=0.23.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pytest-asyncio>=0.21.0",
    "httpx>=0.24.0",
    "ruff>=0.1.0",
    "mypy>=1.5.0",
]
```

### Frontend Requirements

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@radix-ui/react-accordion": "^1.1.2",
    "@radix-ui/react-checkbox": "^1.0.4",
    "@radix-ui/react-collapsible": "^1.0.3",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-slider": "^1.1.2",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-tooltip": "^1.0.7",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "cmdk": "^0.2.0",
    "date-fns": "^2.30.0",
    "lucide-react": "^0.294.0",
    "react-day-picker": "^8.9.1",
    "tailwind-merge": "^2.0.0",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.3.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

### Color Scheme (shadcn/ui CSS Variables)

```css
/* globals.css - shadcn/ui theming with HSL values */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}
```

---

## AI Agent Instructions

### General Guidelines

```markdown
## Code Style

### Python
- Use Python 3.10+ features (type hints, match statements, etc.)
- Follow PEP 8 with max line length of 100 characters
- Use `ruff` for linting and formatting
- All public functions must have docstrings (Google style)
- Use type hints everywhere
- Prefer `async def` for all I/O operations
- Use Pydantic v2 syntax (`model_validator`, `field_validator`)

### TypeScript/React
- Use functional components with hooks
- Use TypeScript strict mode
- Define interfaces for all props
- Use `const` by default, `let` only when needed
- Prefer arrow functions
- Use named exports (no default exports except for pages)
- Component files should be PascalCase
- Utility files should be camelCase

### CSS/Tailwind + shadcn/ui
- Use shadcn/ui components as the primary UI building blocks
- Use Tailwind utility classes for layout and spacing
- Leverage shadcn/ui CSS variables for theming (--background, --foreground, etc.)
- Use `cn()` utility from `@/lib/utils` for conditional classes
- Mobile-first responsive design
- Ensure proper contrast ratios (WCAG AA)
- Prefer shadcn/ui variants over custom styling

## File Organization

- One component per file
- Co-locate tests with source files (*.test.ts)
- Group related utilities in single files
- Keep files under 300 lines, split if larger

## Git Commits

- Use conventional commits (feat:, fix:, docs:, etc.)
- One logical change per commit
- Write clear, descriptive commit messages

## Error Handling

### Python
- Use custom exception classes
- Always provide context in error messages
- Log errors with appropriate levels
- Return proper HTTP status codes

### TypeScript
- Use try-catch with typed errors
- Provide user-friendly error messages
- Show loading and error states in UI
- Use error boundaries for React

## Testing

- Write tests for all public functions
- Use descriptive test names
- Test edge cases and error conditions
- Aim for 80%+ code coverage
```

### Component Implementation Guide

```markdown
## Creating a New Field Renderer

1. Create file in `frontend/src/renderers/`
2. Implement the `RendererProps` interface
3. Register in `renderers/index.tsx`
4. Add Python config in `pydantic_ui/renderers/`

### Example Renderer Template

```tsx
// frontend/src/renderers/MyRenderer.tsx
import { RendererProps } from '../types';
import { cn } from '../utils/cn';

interface MyRendererProps extends RendererProps {
  // Additional props specific to this renderer
  customProp?: string;
}

export function MyRenderer({
  value,
  onChange,
  schema,
  config,
  error,
  disabled,
  customProp,
}: MyRendererProps) {
  return (
    <div className={cn(
      'field-renderer',
      error && 'has-error',
      disabled && 'is-disabled'
    )}>
      {/* Renderer implementation */}
    </div>
  );
}
```

## Adding a New API Endpoint

1. Define request/response models in `pydantic_ui/models.py`
2. Implement handler in `pydantic_ui/handlers.py`
3. Add route in `pydantic_ui/app.py`
4. Add frontend API function in `frontend/src/api.ts`
5. Write tests in `tests/test_handlers.py`
```

### Specific Implementation Tasks

```markdown
## Task: Implement Schema Parser

File: `pydantic_ui/schema.py`

Requirements:
1. Parse Pydantic v2 model to custom schema format
2. Handle these types:
   - Primitives: str, int, float, bool
   - Optional[T] and T | None
   - List[T], Set[T]
   - Dict[str, T]
   - Nested Pydantic models
   - Literal types (as enums)
   - Annotated types with FieldConfig
3. Extract field metadata (title, description, examples)
4. Apply UI configurations from field metadata
5. Handle recursive models (with max depth)

Key functions:
- `parse_model(model: type[BaseModel]) -> SchemaNode`
- `parse_field(field_info: FieldInfo, field_type: type) -> FieldSchema`
- `get_type_info(python_type: type) -> TypeInfo`

---

## Task: Implement Tree Panel

File: `frontend/src/components/TreePanel/`

Requirements:
1. Recursive rendering of schema tree
2. Visual indicators for:
   - Object nodes (folder icon)
   - Array nodes (list icon)
   - Primitive nodes (document icon)
   - Required fields (asterisk)
3. Expand/collapse with chevron icons
4. Selection highlighting
5. Keyboard navigation (up/down arrows, enter to select)
6. Proper indentation with connecting lines
7. Smooth animations for expand/collapse

Props interface:
```tsx
interface TreePanelProps {
  schema: SchemaNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
}
```

---

## Task: Implement Detail Panel

File: `frontend/src/components/DetailPanel/`

Requirements:
1. Show selected node information
2. For objects:
   - Render primitive fields as editable inputs
   - Show nested objects/arrays as clickable cards
   - Group fields by category if configured
3. For arrays:
   - Show list of items as cards
   - Add item button
   - Delete item button per item
   - Empty state message
4. For primitives:
   - Render appropriate field renderer
   - Show validation errors
5. Breadcrumb navigation showing current path

---

## Task: Implement Theme System

Files:
- `frontend/src/context/ThemeContext.tsx`
- `frontend/src/index.css`

Requirements:
1. Support light, dark, and system themes
2. Persist preference to localStorage
3. Listen to system preference changes
4. Apply theme via CSS class on document root
5. Provide useTheme hook for components
6. Smooth transition between themes

Implementation:
1. Create ThemeContext with theme state
2. Define CSS custom properties for all colors
3. Create .light and .dark classes
4. Use prefers-color-scheme media query for system
5. Create ThemeToggle component with icons
```

---

## API Reference

### Backend Usage

```python
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Annotated
from pydantic_ui import create_pydantic_ui, UIConfig, FieldConfig, Renderer

# Define your model
class Address(BaseModel):
    street: str
    city: str
    zipcode: str = Field(pattern=r"^\d{5}$")
    country: str = "USA"

class Person(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    age: Annotated[int, FieldConfig(
        renderer=Renderer.SLIDER,
        props={"min": 0, "max": 120, "step": 1}
    )]
    email: Annotated[str, FieldConfig(renderer=Renderer.EMAIL)]
    bio: Annotated[str | None, FieldConfig(
        renderer=Renderer.TEXT_AREA,
        props={"rows": 4}
    )] = None
    address: Address
    tags: list[str] = []

# Create the app
app = FastAPI()

# Add pydantic-ui router
pydantic_ui = create_pydantic_ui(
    model=Person,
    ui_config=UIConfig(
        title="Person Editor",
        theme="system",
    ),
    prefix="/editor"
)

app.include_router(pydantic_ui)

# Optional: Custom data handlers
@pydantic_ui.data_loader
async def load_data() -> Person:
    # Load from database, file, etc.
    return Person(name="John", age=30, ...)

@pydantic_ui.data_saver
async def save_data(data: Person) -> None:
    # Save to database, file, etc.
    pass
```

### Field Configuration via Annotations

```python
from typing import Annotated
from pydantic_ui import FieldConfig, Renderer

class MyModel(BaseModel):
    # Slider for numeric input
    priority: Annotated[int, FieldConfig(
        renderer=Renderer.SLIDER,
        label="Priority Level",
        help_text="Higher values = more important",
        props={"min": 1, "max": 10}
    )]
    
    # Dropdown for enum-like strings
    status: Annotated[str, FieldConfig(
        renderer=Renderer.SELECT,
        props={"options": ["draft", "published", "archived"]}
    )]
    
    # Multi-select for lists
    categories: Annotated[list[str], FieldConfig(
        renderer=Renderer.MULTI_SELECT,
        props={"options": ["tech", "news", "sports"]}
    )]
    
    # Rich text area
    content: Annotated[str, FieldConfig(
        renderer=Renderer.TEXT_AREA,
        props={"rows": 10, "placeholder": "Write your content..."}
    )]
    
    # Hidden field
    internal_id: Annotated[str, FieldConfig(hidden=True)]
    
    # Read-only field
    created_at: Annotated[datetime, FieldConfig(read_only=True)]
```

### Frontend API Client

```typescript
// Auto-generated types from schema
interface Schema {
  name: string;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  fields?: Record<string, Schema>;
  items?: Schema;
  constraints?: Constraints;
  ui_config?: UIConfig;
}

// API functions
const api = {
  getSchema: () => fetch('/api/schema').then(r => r.json()),
  getData: () => fetch('/api/data').then(r => r.json()),
  updateData: (data: unknown) => 
    fetch('/api/data', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }).then(r => r.json()),
  validateData: (data: unknown) =>
    fetch('/api/validate', {
      method: 'POST',
      body: JSON.stringify(data)
    }).then(r => r.json()),
};
```

---

## Usage Examples

### Basic Usage

```python
# examples/basic/main.py
from fastapi import FastAPI
from pydantic import BaseModel
from pydantic_ui import create_pydantic_ui

class Settings(BaseModel):
    app_name: str = "My App"
    debug: bool = False
    max_connections: int = 100
    api_key: str = ""

app = FastAPI()
app.include_router(
    create_pydantic_ui(Settings, prefix="/settings")
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### With Custom Renderers

```python
# examples/custom_renderers/main.py
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Annotated
from pydantic_ui import create_pydantic_ui, FieldConfig, Renderer, UIConfig

class GameSettings(BaseModel):
    player_name: str = Field(min_length=3, max_length=20)
    difficulty: Annotated[int, FieldConfig(
        renderer=Renderer.SLIDER,
        label="Difficulty",
        props={"min": 1, "max": 10, "step": 1, "marks": True}
    )] = 5
    volume: Annotated[int, FieldConfig(
        renderer=Renderer.SLIDER,
        props={"min": 0, "max": 100, "suffix": "%"}
    )] = 80
    fullscreen: Annotated[bool, FieldConfig(
        renderer=Renderer.TOGGLE
    )] = False
    resolution: Annotated[str, FieldConfig(
        renderer=Renderer.SELECT,
        props={"options": ["1920x1080", "2560x1440", "3840x2160"]}
    )] = "1920x1080"

app = FastAPI()
app.include_router(
    create_pydantic_ui(
        GameSettings,
        ui_config=UIConfig(title="Game Settings", theme="dark"),
        prefix="/settings"
    )
)
```

### Complex Nested Models

```python
# examples/complex_models/main.py
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Annotated
from datetime import datetime
from pydantic_ui import create_pydantic_ui, FieldConfig, Renderer

class ContactInfo(BaseModel):
    email: Annotated[str, FieldConfig(renderer=Renderer.EMAIL)]
    phone: str = ""
    
class Address(BaseModel):
    street: str
    city: str
    state: str
    zipcode: str
    country: str = "USA"

class Employee(BaseModel):
    id: Annotated[str, FieldConfig(read_only=True)]
    name: str
    position: str
    contact: ContactInfo
    hire_date: datetime
    
class Department(BaseModel):
    name: str
    budget: Annotated[float, FieldConfig(
        props={"prefix": "$", "precision": 2}
    )]
    head: Employee | None = None
    employees: list[Employee] = []

class Company(BaseModel):
    name: str
    founded: int
    active: bool = True
    headquarters: Address
    departments: list[Department] = []
    tags: list[str] = []

app = FastAPI()
app.include_router(
    create_pydantic_ui(Company, prefix="/company-editor")
)
```

---

## Checklist

### Phase 1: Core Backend
- [ ] Initialize pyproject.toml
- [ ] Create package structure
- [ ] Implement schema parser
- [ ] Implement config classes
- [ ] Create FastAPI router factory
- [ ] Add API endpoints
- [ ] Add static file serving
- [ ] Write backend tests

### Phase 2: Frontend Foundation
- [ ] Initialize Vite project
- [ ] Configure Tailwind CSS with shadcn/ui
- [ ] Initialize shadcn/ui and install components
- [ ] Set up theme system (light/dark mode)
- [ ] Create Layout component
- [ ] Implement TreePanel using Collapsible
- [ ] Implement DetailPanel using Card components
- [ ] Create Header with theme toggle

### Phase 3: Field Renderers
- [ ] Create renderer registry
- [ ] Implement TextInput
- [ ] Implement NumberInput
- [ ] Implement Checkbox/Toggle
- [ ] Implement Select
- [ ] Implement Slider
- [ ] Implement TextArea
- [ ] Implement DatePicker
- [ ] Array add/remove UI

### Phase 4: Integration
- [ ] Connect frontend to API
- [ ] Implement data loading
- [ ] Implement data saving
- [ ] Add validation display
- [ ] Build integration script
- [ ] Create examples

### Phase 5: Polish & Release
- [ ] Write documentation
- [ ] Add comprehensive tests
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Publish to PyPI

---

## Notes for AI Agents

1. **Always start by reading relevant existing code** before making changes
2. **Run tests** after implementing features
3. **Follow the established patterns** in the codebase
4. **Ask for clarification** if requirements are ambiguous
5. **Commit frequently** with descriptive messages
6. **Update documentation** when adding features
7. **Consider edge cases** (empty arrays, null values, deep nesting)
8. **Ensure accessibility** (keyboard nav, screen readers, contrast)
9. **Test both light and dark themes** when changing styles
10. **Keep bundle size small** - avoid unnecessary dependencies

# Testing Plan for pydantic-ui

This document outlines the comprehensive testing strategy for the pydantic-ui package, aiming for near 100% test coverage on both backend (Python) and frontend (React/TypeScript).

---

## 📋 Overview

| Component | Test Framework | Coverage Tool | Test Runner |
|-----------|---------------|---------------|-------------|
| **Backend (Python)** | pytest + pytest-asyncio | coverage.py | pytest |
| **Frontend (React/TS)** | Vitest + React Testing Library | @vitest/coverage-v8 | Vitest |
| **E2E (Optional)** | Playwright | Built-in | Playwright Test |

---

## 🐍 Backend Testing Stack

### Recommended Dependencies

Add to `pyproject.toml` under `[project.optional-dependencies]`:

```toml
[project.optional-dependencies]
dev = [
    # Testing
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "pytest-cov>=4.1.0",
    "httpx>=0.27.0",  # For async test client
    
    # Mocking
    "pytest-mock>=3.12.0",
    "respx>=0.20.0",  # HTTP mocking for httpx
    
    # Type checking
    "mypy>=1.8.0",
    
    # Linting
    "ruff>=0.1.0",
    
    # Test fixtures
    "faker>=22.0.0",  # Generate realistic test data
]
```

### Backend Test Structure

```
tests/
├── __init__.py
├── conftest.py                 # Shared fixtures
├── fixtures/                   # Test data fixtures
│   ├── __init__.py
│   └── models.py               # Test Pydantic models
├── unit/                       # Unit tests
│   ├── __init__.py
│   ├── test_schema.py          # Schema parsing tests
│   ├── test_config.py          # Configuration tests
│   ├── test_handlers.py        # DataHandler tests
│   ├── test_utils.py           # Utility function tests
│   ├── test_sessions.py        # Session management tests
│   ├── test_events.py          # Event queue tests
│   ├── test_controller.py      # Controller tests
│   └── test_models.py          # Internal models tests
├── integration/                # Integration tests
│   ├── __init__.py
│   ├── test_api_schema.py      # /api/schema endpoint
│   ├── test_api_data.py        # /api/data endpoints (GET/POST/PATCH)
│   ├── test_api_validation.py  # /api/validate endpoint
│   ├── test_api_config.py      # /api/config endpoint
│   ├── test_api_actions.py     # /api/actions/* endpoints
│   ├── test_api_events.py      # /api/events SSE endpoint
│   ├── test_api_sessions.py    # Session management
│   └── test_router_factory.py  # create_pydantic_ui tests
└── e2e/                        # End-to-end tests (optional)
    ├── __init__.py
    └── test_full_workflow.py
```

### Test Categories & Coverage Targets

#### 1. Unit Tests - `tests/unit/`

##### `test_schema.py` - Schema Parsing (Target: 100%)

```python
"""Tests for pydantic_ui/schema.py"""

# Test parse_model()
- test_parse_simple_model()
- test_parse_model_with_nested_model()
- test_parse_model_with_list_field()
- test_parse_model_with_dict_field()
- test_parse_model_with_optional_fields()
- test_parse_model_max_depth()
- test_parse_model_with_docstring()

# Test parse_field()
- test_parse_string_field()
- test_parse_int_field()
- test_parse_float_field()
- test_parse_bool_field()
- test_parse_datetime_field()
- test_parse_date_field()
- test_parse_time_field()
- test_parse_enum_field()
- test_parse_str_enum_field()
- test_parse_literal_field()
- test_parse_optional_field()
- test_parse_union_field()
- test_parse_list_field()
- test_parse_set_field()
- test_parse_tuple_field()
- test_parse_dict_field()
- test_parse_nested_model_field()
- test_parse_annotated_field_with_field_config()
- test_parse_field_with_constraints()
- test_parse_field_with_default()
- test_parse_field_with_default_factory()
- test_parse_field_with_title()
- test_parse_field_with_description()

# Test get_json_type()
- test_get_json_type_primitives()
- test_get_json_type_collections()
- test_get_json_type_datetime()
- test_get_json_type_enum()
- test_get_json_type_none()
- test_get_json_type_unknown()

# Test get_python_type_name()
- test_get_python_type_name_simple()
- test_get_python_type_name_generic()
- test_get_python_type_name_union()

# Test get_format_for_type()
- test_get_format_datetime()
- test_get_format_date()
- test_get_format_time()
- test_get_format_none()

# Test get_enum_values()
- test_get_enum_values_standard()
- test_get_enum_values_str_enum()
- test_get_enum_values_int_enum()
- test_get_enum_values_non_enum()

# Test extract_field_config()
- test_extract_field_config_from_annotated()
- test_extract_field_config_from_metadata()
- test_extract_field_config_none()

# Test get_constraints()
- test_get_constraints_numeric()
- test_get_constraints_string()
- test_get_constraints_literal()
- test_get_constraints_empty()

# Test model_to_data()
- test_model_to_data_with_instance()
- test_model_to_data_without_instance()
- test_model_to_data_with_defaults()
- test_model_to_data_exception_handling()
```

##### `test_config.py` - Configuration (Target: 100%)

```python
"""Tests for pydantic_ui/config.py"""

# Test Renderer enum
- test_renderer_values()
- test_renderer_auto()

# Test FieldConfig
- test_field_config_defaults()
- test_field_config_all_options()
- test_field_config_renderer_enum()
- test_field_config_renderer_string()
- test_field_config_serialization()

# Test UIConfig
- test_ui_config_defaults()
- test_ui_config_all_options()
- test_ui_config_with_actions()
- test_ui_config_serialization()

# Test ActionButton
- test_action_button_defaults()
- test_action_button_all_options()
- test_action_button_variants()
```

##### `test_handlers.py` - Data Handler (Target: 100%)

```python
"""Tests for pydantic_ui/handlers.py"""

# Test DataHandler initialization
- test_handler_init_with_defaults()
- test_handler_init_with_initial_data()
- test_handler_init_with_data_loader()
- test_handler_init_with_field_configs()

# Test get_schema()
- test_get_schema_basic()
- test_get_schema_with_field_configs()
- test_get_schema_wildcard_patterns()

# Test _apply_field_configs()
- test_apply_field_configs_direct_path()
- test_apply_field_configs_wildcard_path()
- test_apply_field_configs_nested()
- test_apply_field_configs_array_items()

# Test get_data()
- test_get_data_basic()
- test_get_data_with_loader()
- test_get_data_async_loader()
- test_get_data_loader_exception()

# Test update_data()
- test_update_data_valid()
- test_update_data_invalid()
- test_update_data_with_saver()
- test_update_data_async_saver()

# Test partial_update()
- test_partial_update_simple()
- test_partial_update_nested()
- test_partial_update_array_item()
- test_partial_update_invalid()
- test_partial_update_with_saver()

# Test validate_data()
- test_validate_data_valid()
- test_validate_data_invalid()
- test_validate_data_multiple_errors()

# Test get_config()
- test_get_config_basic()
- test_get_config_with_actions()
```

##### `test_utils.py` - Utilities (Target: 100%)

```python
"""Tests for pydantic_ui/utils.py"""

# Test get_value_at_path()
- test_get_value_simple()
- test_get_value_nested()
- test_get_value_array_index()
- test_get_value_array_bracket_notation()
- test_get_value_mixed_path()
- test_get_value_root()
- test_get_value_empty_path()
- test_get_value_not_found()
- test_get_value_invalid_index()

# Test set_value_at_path()
- test_set_value_simple()
- test_set_value_nested()
- test_set_value_array_index()
- test_set_value_create_nested()
- test_set_value_create_array()
- test_set_value_root()
- test_set_value_extend_array()

# Test delete_at_path()
- test_delete_simple()
- test_delete_nested()
- test_delete_array_item()
- test_delete_root()
- test_delete_not_found()
```

##### `test_sessions.py` - Session Management (Target: 100%)

```python
"""Tests for pydantic_ui/sessions.py"""

# Test Session
- test_session_creation()
- test_session_push_event()
- test_session_subscribe()
- test_session_get_pending_events()
- test_session_touch()
- test_session_event_queue_max_size()
- test_session_multiple_subscribers()

# Test SessionManager
- test_manager_create_session_id()
- test_manager_get_or_create_new()
- test_manager_get_or_create_existing()
- test_manager_get_session()
- test_manager_get_session_not_found()
- test_manager_remove_session()
- test_manager_cleanup_inactive()
- test_manager_session_count()
- test_manager_broadcast_event()
```

##### `test_events.py` - Event Queue (Target: 100%)

```python
"""Tests for pydantic_ui/events.py"""

# Test EventQueue
- test_event_queue_push()
- test_event_queue_subscribe()
- test_event_queue_get_pending()
- test_event_queue_clear()
- test_event_queue_max_size()
- test_event_queue_multiple_subscribers()
- test_event_queue_slow_subscriber()
```

##### `test_controller.py` - Controller (Target: 100%)

```python
"""Tests for pydantic_ui/controller.py"""

# Test PydanticUIController
- test_controller_init()
- test_controller_no_session_error()
- test_show_validation_errors()
- test_clear_validation_errors()
- test_push_data_dict()
- test_push_data_model()
- test_show_toast()
- test_show_toast_variants()
- test_request_confirmation_confirmed()
- test_request_confirmation_cancelled()
- test_request_confirmation_timeout()
- test_refresh()
- test_get_current_data()
- test_get_model_instance()
- test_get_model_instance_invalid()
- test_broadcast_toast()
- test_broadcast_refresh()
```

##### `test_models.py` - Internal Models (Target: 100%)

```python
"""Tests for pydantic_ui/models.py"""

# Test all model classes
- test_action_button_response()
- test_schema_field()
- test_schema_field_nested()
- test_schema_response()
- test_data_response()
- test_data_update_request()
- test_partial_update_request()
- test_validation_request()
- test_validation_error()
- test_validation_response()
- test_config_response()
```

#### 2. Integration Tests - `tests/integration/`

##### `test_api_schema.py`

```python
"""Tests for GET /api/schema endpoint"""

- test_get_schema_simple_model()
- test_get_schema_complex_model()
- test_get_schema_with_field_configs()
- test_get_schema_response_format()
```

##### `test_api_data.py`

```python
"""Tests for /api/data endpoints"""

# GET /api/data
- test_get_data_initial()
- test_get_data_with_session()
- test_get_data_with_loader()
- test_get_data_sets_cookie()

# POST /api/data
- test_post_data_valid()
- test_post_data_invalid()
- test_post_data_with_saver()
- test_post_data_updates_session()

# PATCH /api/data
- test_patch_data_simple()
- test_patch_data_nested()
- test_patch_data_array()
- test_patch_data_invalid()
- test_patch_data_with_saver()
```

##### `test_api_validation.py`

```python
"""Tests for POST /api/validate endpoint"""

- test_validate_valid_data()
- test_validate_invalid_data()
- test_validate_multiple_errors()
- test_validate_nested_errors()
```

##### `test_api_config.py`

```python
"""Tests for GET /api/config endpoint"""

- test_get_config_defaults()
- test_get_config_custom()
- test_get_config_with_actions()
```

##### `test_api_actions.py`

```python
"""Tests for /api/actions/* endpoints"""

- test_action_registered()
- test_action_not_found()
- test_action_sync_handler()
- test_action_async_handler()
- test_action_handler_error()
- test_action_with_controller()
```

##### `test_api_events.py`

```python
"""Tests for /api/events SSE endpoint"""

- test_events_stream()
- test_events_poll_fallback()
- test_events_with_session()
```

##### `test_api_sessions.py`

```python
"""Tests for session management via API"""

- test_session_creation()
- test_session_persistence()
- test_session_cookie()
- test_session_data_isolation()
```

##### `test_router_factory.py`

```python
"""Tests for create_pydantic_ui factory function"""

- test_create_router_basic()
- test_create_router_with_config()
- test_create_router_with_prefix()
- test_create_router_decorators()
- test_data_loader_decorator()
- test_data_saver_decorator()
- test_action_decorator()
- test_static_files_served()
- test_placeholder_served()
```

##### `test_api_confirmation.py`

```python
"""Tests for /api/confirmation/* endpoints"""

- test_confirmation_response_confirmed()
- test_confirmation_response_cancelled()
- test_confirmation_unknown_id()
```

### Backend Test Configuration

#### `pytest.ini` / `pyproject.toml`

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
python_files = ["test_*.py"]
python_functions = ["test_*"]
addopts = [
    "-v",
    "--strict-markers",
    "--tb=short",
]
markers = [
    "slow: marks tests as slow",
    "integration: marks tests as integration tests",
]

[tool.coverage.run]
source = ["pydantic_ui"]
branch = true
parallel = true
omit = [
    "pydantic_ui/__pycache__/*",
    "pydantic_ui/static/*",
]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise NotImplementedError",
    "if TYPE_CHECKING:",
    "if __name__ == .__main__.:",
    "@abstractmethod",
]
fail_under = 95
show_missing = true
```

---

## ⚛️ Frontend Testing Stack

### Recommended Dependencies

Add to `frontend/package.json`:

```json
{
  "devDependencies": {
    // Testing Framework
    "@testing-library/react": "^14.2.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/user-event": "^14.5.0",
    
    // Test Runner
    "vitest": "^1.3.0",
    "@vitest/coverage-v8": "^1.3.0",
    "@vitest/ui": "^1.3.0",
    
    // Mocking
    "msw": "^2.1.0",  // Mock Service Worker for API mocking
    
    // React testing utilities
    "jsdom": "^24.0.0",
    
    // Type definitions
    "@types/testing-library__jest-dom": "^6.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Frontend Test Structure

```
frontend/
├── src/
│   └── ...
├── tests/
│   ├── setup.ts                    # Test setup and global mocks
│   ├── mocks/
│   │   ├── handlers.ts             # MSW handlers
│   │   ├── server.ts               # MSW server setup
│   │   └── data.ts                 # Mock data fixtures
│   ├── unit/
│   │   ├── lib/
│   │   │   └── utils.test.ts       # cn() and other utilities
│   │   ├── api.test.ts             # API client tests
│   │   └── types.test.ts           # Type guard tests
│   ├── components/
│   │   ├── ui/                     # shadcn/ui component tests (minimal)
│   │   │   └── button.test.tsx
│   │   ├── Renderers/
│   │   │   ├── TextInput.test.tsx
│   │   │   ├── NumberInput.test.tsx
│   │   │   ├── CheckboxInput.test.tsx
│   │   │   ├── ToggleInput.test.tsx
│   │   │   ├── SelectInput.test.tsx
│   │   │   ├── SliderInput.test.tsx
│   │   │   ├── TextareaInput.test.tsx
│   │   │   ├── DateInput.test.tsx
│   │   │   ├── ColorInput.test.tsx
│   │   │   ├── JsonInput.test.tsx
│   │   │   └── index.test.tsx      # FieldRenderer & getDefaultRenderer
│   │   ├── TreePanel/
│   │   │   ├── TreeNode.test.tsx
│   │   │   ├── TreeNodeContextMenu.test.tsx
│   │   │   ├── PasteSelectedDialog.test.tsx
│   │   │   └── index.test.tsx
│   │   ├── DetailPanel/
│   │   │   ├── ObjectEditor.test.tsx
│   │   │   ├── NestedFieldCard.test.tsx
│   │   │   └── index.test.tsx
│   │   ├── Header/
│   │   │   └── index.test.tsx
│   │   ├── Layout/
│   │   │   └── index.test.tsx
│   │   ├── ActionButtons/
│   │   │   └── index.test.tsx
│   │   ├── ConfirmationDialog/
│   │   │   └── index.test.tsx
│   │   └── ToastContainer/
│   │       └── index.test.tsx
│   ├── context/
│   │   ├── DataContext.test.tsx
│   │   ├── ThemeContext.test.tsx
│   │   ├── ClipboardContext.test.tsx
│   │   └── EventContext.test.tsx
│   └── integration/
│       ├── App.test.tsx
│       ├── TreeNavigation.test.tsx
│       ├── DataEditing.test.tsx
│       └── ActionHandling.test.tsx
└── vitest.config.ts
```

### Frontend Test Categories & Coverage

#### 1. Unit Tests - `tests/unit/`

##### `api.test.ts`

```typescript
describe('createApiClient', () => {
  // Basic functionality
  it('creates client with default apiBase')
  it('creates client with custom apiBase')
  
  // API methods
  describe('getSchema', () => {
    it('fetches schema successfully')
    it('handles fetch error')
  })
  
  describe('getConfig', () => {
    it('fetches config successfully')
  })
  
  describe('getData', () => {
    it('fetches data successfully')
    it('includes credentials')
  })
  
  describe('updateData', () => {
    it('sends POST request with data')
    it('returns validation errors')
  })
  
  describe('partialUpdate', () => {
    it('sends PATCH request with path and value')
  })
  
  describe('validateData', () => {
    it('validates data without saving')
  })
  
  describe('triggerAction', () => {
    it('triggers action with data')
    it('returns error on failure')
  })
  
  describe('respondToConfirmation', () => {
    it('sends confirmation response')
  })
})
```

##### `lib/utils.test.ts`

```typescript
describe('cn utility', () => {
  it('merges class names')
  it('handles conditional classes')
  it('deduplicates tailwind classes')
  it('handles undefined values')
})
```

#### 2. Component Tests - `tests/components/`

##### Renderer Tests

Each renderer should test:
- Renders correctly with value
- Handles onChange callback
- Displays error state
- Handles disabled state
- Shows help text
- Respects ui_config props

```typescript
// Example: TextInput.test.tsx
describe('TextInput', () => {
  it('renders with initial value')
  it('calls onChange when typing')
  it('shows placeholder from schema')
  it('shows placeholder from ui_config')
  it('displays error message')
  it('applies disabled state')
  it('shows help text')
  it('respects maxLength constraint')
  it('shows character count when near limit')
})
```

##### TreePanel Tests

```typescript
describe('TreePanel', () => {
  it('renders tree structure from schema')
  it('expands/collapses nodes')
  it('highlights selected node')
  it('shows error badges')
  it('handles array items')
  it('shows type badges when enabled')
})

describe('TreeNode', () => {
  it('renders leaf node')
  it('renders expandable node')
  it('shows correct icon for type')
  it('handles click selection')
  it('handles expand toggle')
})

describe('TreeNodeContextMenu', () => {
  it('shows copy option')
  it('shows paste option when clipboard has data')
  it('shows add item for arrays')
  it('shows delete item for array items')
})
```

##### DetailPanel Tests

```typescript
describe('DetailPanel', () => {
  it('renders nothing when no selection')
  it('renders ObjectEditor for objects')
  it('renders primitive fields')
  it('shows breadcrumb navigation')
})

describe('ObjectEditor', () => {
  it('renders all fields')
  it('groups fields by category')
  it('hides hidden fields')
  it('renders nested cards')
})

describe('NestedFieldCard', () => {
  it('displays field name and type')
  it('shows item count for arrays')
  it('navigates on click')
})
```

##### Header Tests

```typescript
describe('Header', () => {
  it('renders title from config')
  it('shows action buttons')
  it('shows save/reset when enabled')
  it('disables save when not dirty')
})
```

#### 3. Context Tests - `tests/context/`

##### `DataContext.test.tsx`

```typescript
describe('DataProvider', () => {
  it('provides initial state')
  it('loads schema on mount')
  it('loads config on mount')
  it('loads data on mount')
})

describe('useData', () => {
  it('throws when used outside provider')
  
  describe('updateValue', () => {
    it('updates simple path')
    it('updates nested path')
    it('updates array index')
    it('marks as dirty')
  })
  
  describe('saveData', () => {
    it('sends data to API')
    it('clears dirty flag on success')
    it('sets errors on validation failure')
    it('normalizes error paths')
  })
  
  describe('resetData', () => {
    it('restores original data')
    it('clears errors')
    it('clears dirty flag')
  })
  
  describe('toggleExpanded', () => {
    it('expands collapsed path')
    it('collapses expanded path')
  })
  
  describe('expandPath', () => {
    it('expands all parent paths')
  })
  
  describe('getErrorCountForPath', () => {
    it('returns count for exact path')
    it('aggregates child errors')
  })
  
  describe('setExternalErrors', () => {
    it('sets errors from SSE event')
    it('normalizes paths')
  })
  
  describe('setExternalData', () => {
    it('updates data from SSE event')
    it('clears dirty flag')
  })
})
```

##### `ThemeContext.test.tsx`

```typescript
describe('ThemeProvider', () => {
  it('defaults to system theme')
  it('applies dark class when dark')
  it('removes dark class when light')
  it('persists theme to localStorage')
})
```

##### `ClipboardContext.test.tsx`

```typescript
describe('ClipboardProvider', () => {
  it('copies data to clipboard')
  it('pastes data from clipboard')
  it('handles multiple items')
})
```

##### `EventContext.test.tsx`

```typescript
describe('EventProvider', () => {
  it('connects to SSE endpoint')
  it('handles toast events')
  it('handles validation_errors events')
  it('handles confirmation_request events')
  it('handles push_data events')
  it('handles refresh events')
  it('falls back to polling')
})
```

#### 4. Integration Tests - `tests/integration/`

```typescript
describe('App Integration', () => {
  it('renders full app')
  it('navigates tree and shows detail')
  it('edits values and saves')
  it('shows validation errors')
  it('handles action buttons')
  it('shows confirmation dialogs')
  it('displays toasts')
})
```

### Frontend Test Configuration

#### `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/components/ui/**',  // shadcn components - tested upstream
        'src/**/*.d.ts',
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

#### `tests/setup.ts`

```typescript
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, afterAll, vi } from 'vitest'
import { server } from './mocks/server'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Start MSW server
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
```

#### `tests/mocks/handlers.ts`

```typescript
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/api/schema', () => {
    return HttpResponse.json({
      name: 'TestModel',
      type: 'object',
      fields: {
        name: { type: 'string', title: 'Name', required: true },
        age: { type: 'integer', title: 'Age', required: false },
      },
    })
  }),
  
  http.get('/api/config', () => {
    return HttpResponse.json({
      title: 'Test Editor',
      description: '',
      theme: 'system',
      read_only: false,
      show_validation: true,
      auto_save: false,
      auto_save_delay: 1000,
      collapsible_tree: true,
      show_types: true,
      actions: [],
      show_save_reset: true,
    })
  }),
  
  http.get('/api/data', () => {
    return HttpResponse.json({
      data: { name: 'John', age: 30 },
    })
  }),
  
  http.post('/api/data', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      data: body.data,
      valid: true,
    })
  }),
  
  // Add more handlers as needed
]
```

---

## 🔄 GitHub Actions CI/CD

### `.github/workflows/test.yml`

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.10', '3.11', '3.12']

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python ${{ matrix.python-version }}
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}

      - name: Install uv
        uses: astral-sh/setup-uv@v4
        with:
          version: "latest"

      - name: Install dependencies
        run: |
          uv pip install -e ".[dev]" --system

      - name: Run linting
        run: |
          ruff check pydantic_ui tests
          ruff format --check pydantic_ui tests

      - name: Run type checking
        run: |
          mypy pydantic_ui

      - name: Run tests with coverage
        run: |
          pytest --cov=pydantic_ui --cov-report=xml --cov-report=html --cov-fail-under=95

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage.xml
          flags: backend
          name: backend-py${{ matrix.python-version }}

  frontend-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Run linting
        working-directory: frontend
        run: npm run lint

      - name: Run type checking
        working-directory: frontend
        run: npx tsc --noEmit

      - name: Run tests with coverage
        working-directory: frontend
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          file: ./frontend/coverage/lcov.info
          flags: frontend
          name: frontend

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [backend-tests, frontend-tests]

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install uv
        uses: astral-sh/setup-uv@v4

      - name: Install Python dependencies
        run: uv pip install -e ".[dev]" --system

      - name: Install frontend dependencies
        working-directory: frontend
        run: npm ci

      - name: Build frontend
        working-directory: frontend
        run: npm run build:package

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npx playwright test
        env:
          CI: true

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 📊 Coverage Goals & Reporting

### Coverage Targets

| Component | Line Coverage | Branch Coverage | Function Coverage |
|-----------|--------------|-----------------|-------------------|
| Backend   | ≥95%         | ≥90%            | ≥95%              |
| Frontend  | ≥90%         | ≥85%            | ≥90%              |

### Coverage Report Badge

Add to README.md:
```markdown
[![codecov](https://codecov.io/gh/yourusername/pydantic-ui/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/pydantic-ui)
```

### Codecov Configuration

`.codecov.yml`:
```yaml
coverage:
  precision: 2
  round: down
  range: "70...100"
  status:
    project:
      default:
        target: auto
        threshold: 2%
    patch:
      default:
        target: 90%

flags:
  backend:
    paths:
      - pydantic_ui/
    carryforward: true
  frontend:
    paths:
      - frontend/src/
    carryforward: true

comment:
  layout: "reach,diff,flags,files"
  behavior: default
  require_changes: true
```

---

## 🚀 Quick Start Commands

### Backend

```bash
# Install dev dependencies
uv pip install -e ".[dev]"

# Run all tests
pytest

# Run with coverage
pytest --cov=pydantic_ui --cov-report=html

# Run specific test file
pytest tests/unit/test_schema.py

# Run tests matching pattern
pytest -k "test_parse"

# Run only unit tests
pytest tests/unit/

# Run only integration tests
pytest tests/integration/ -m integration
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run with coverage
npm run test:coverage

# Open Vitest UI
npm run test:ui
```

---

## 📝 Test Writing Guidelines

### Python Tests

1. **Use fixtures** for common setup
2. **Parametrize** tests for multiple cases
3. **Use `pytest.raises`** for exception testing
4. **Mock external dependencies** with `pytest-mock`
5. **Use `httpx.AsyncClient`** for API testing
6. **Follow AAA pattern**: Arrange, Act, Assert

### React/TypeScript Tests

1. **Use `render` from RTL** for component tests
2. **Query by accessibility roles** first
3. **Use `userEvent`** over `fireEvent`
4. **Mock API with MSW** for consistency
5. **Test behavior, not implementation**
6. **Use `waitFor`** for async assertions

---

## 🎯 Priority Implementation Order

1. **Phase 1: Backend Unit Tests** (Week 1)
   - `test_schema.py` - Most critical
   - `test_utils.py` - Foundation utilities
   - `test_config.py` - Configuration

2. **Phase 2: Backend Integration Tests** (Week 2)
   - `test_api_data.py` - Core functionality
   - `test_api_schema.py`
   - `test_router_factory.py`

3. **Phase 3: Frontend Unit Tests** (Week 3)
   - Renderer tests
   - Context tests
   - API client tests

4. **Phase 4: Frontend Component Tests** (Week 4)
   - TreePanel tests
   - DetailPanel tests
   - Integration tests

5. **Phase 5: E2E Tests** (Week 5)
   - Full workflow tests
   - Cross-browser testing

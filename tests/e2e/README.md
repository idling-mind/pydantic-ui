# E2E Tests for Pydantic UI

This directory contains end-to-end (E2E) tests for the Pydantic UI application using Playwright with Python.

## Setup

1. **Install dependencies:**

```bash
# Using uv (recommended)
uv pip install -e ".[dev]"

# Or using pip
pip install -e ".[dev]"
```

2. **Install Playwright browsers:**

```bash
playwright install chromium
# Or install all browsers
playwright install
```

## Running Tests

### Start the E2E test application first:

```bash
# Start the dedicated e2e test application
uv run python examples/e2e_test_app.py
```

This starts a FastAPI server at `http://localhost:8000` with a model specifically designed for E2E testing.

### Run all E2E tests:

```bash
# Using uv
uv run pytest tests/e2e/

# Or with pytest directly
pytest tests/e2e/
```

### Run specific test file:

```bash
uv run pytest tests/e2e/test_app.py
uv run pytest tests/e2e/test_data_operations.py
uv run pytest tests/e2e/test_field_renderers.py
uv run pytest tests/e2e/test_tree_navigation.py
uv run pytest tests/e2e/test_ui_config.py
```

### Run specific test:

```bash
uv run pytest tests/e2e/test_app.py::TestApplicationLoading::test_loads_main_ui
```

### Run with options:

```bash
# Headless mode (faster, no browser window)
uv run pytest tests/e2e/ --headed=false

# Different browser
uv run pytest tests/e2e/ --browser firefox
uv run pytest tests/e2e/ --browser webkit

# Slower for debugging (increase delay between actions)
uv run pytest tests/e2e/ --slowmo 500

# With verbose output
uv run pytest tests/e2e/ -v

# With captured output
uv run pytest tests/e2e/ -s
```

### Skip E2E tests:

```bash
# Run only unit and integration tests
uv run pytest -m "not e2e"
```

## Test Structure

```
tests/e2e/
├── __init__.py
├── conftest.py              # Pytest fixtures for E2E tests
├── helpers.py               # Helper functions and SELECTORS dict
├── README.md                # This file
├── test_app.py              # Application loading and basic functionality
├── test_data_operations.py  # Data CRUD operations
├── test_field_renderers.py  # Field renderer components
├── test_tree_navigation.py  # Tree navigation functionality
└── test_ui_config.py        # UI configuration and theming
```

## Key Helpers (helpers.py)

The `helpers.py` module provides:

### SELECTORS Dictionary

A comprehensive dictionary of all `data-pydantic-ui` selectors:

```python
from tests.e2e.helpers import SELECTORS

# Use selectors
page.locator(SELECTORS["save_button"])
page.locator(SELECTORS["tree_panel"])
page.locator(SELECTORS["detail_panel"])
```

### Selector Helper Functions

```python
from tests.e2e.helpers import get_field_by_type, get_field_by_path

# Get all text fields
text_fields = page.locator(get_field_by_type("text"))

# Get specific field by path
name_field = page.locator(get_field_by_path("app_name"))
```

### Navigation Functions

```python
from tests.e2e.helpers import (
    wait_for_app_load,
    wait_for_tree_loaded,
    click_tree_node,
    expand_tree_node,
    expand_all_tree_nodes,
    collapse_all_tree_nodes,
)

wait_for_app_load(page)
click_tree_node(page, "owner")
expand_all_tree_nodes(page)
```

### Field Interaction Functions

```python
from tests.e2e.helpers import (
    fill_text_field,
    fill_number_field,
    toggle_boolean_field,
    select_option,
)

fill_text_field(page, "app_name", "New Name")
fill_number_field(page, "port", 3000)
toggle_boolean_field(page, "debug_mode")
```

### Save/Reset Functions

```python
from tests.e2e.helpers import (
    save_data,
    reset_data,
    is_save_button_enabled,
    is_reset_button_enabled,
    has_unsaved_changes,
)

if is_save_button_enabled(page):
    save_data(page)
```

### Theme Functions

```python
from tests.e2e.helpers import switch_theme, is_dark_mode

switch_theme(page, "dark")
assert is_dark_mode(page)
```

## Test Coverage

### `test_app.py`
- Application loading and initialization
- API integration (schema, data, config)
- Tree and detail panel visibility
- Save/reset functionality
- Custom action buttons
- Theme support
- Error handling
- Responsive design

### `test_data_operations.py`
- Data loading and population
- Data saving and validation
- Data reset functionality
- Array operations (add, remove, reorder)
- Nested object updates
- Real-time updates

### `test_field_renderers.py`
- Text inputs (single-line, multi-line)
- Number inputs and sliders
- Boolean toggles and checkboxes
- Select dropdowns
- Date/time pickers
- Color pickers
- Field validation
- Custom renderer props

### `test_tree_navigation.py`
- Tree structure display
- Node selection and expansion/collapse
- Nested object navigation
- Array node handling
- Context menu functionality
- Keyboard navigation

### `test_ui_config.py`
- Theme switching (light/dark/system)
- Custom titles and descriptions
- Action buttons
- Layout responsiveness
- Header and footer
- Loading and error states

## Prerequisites for Running Tests

The E2E tests require a running instance of the Pydantic UI application. Before running tests:

1. **Start the application:**

```bash
# From the examples directory
cd examples
uv run python main.py
```

2. **Or use the build-test script:**

```powershell
# From project root
./scripts/build-test.ps1
```

The tests expect the application to be running at `http://localhost:8000` by default.

### Custom Base URL

To test against a different URL, modify the `base_url` fixture in `conftest.py`:

```python
@pytest.fixture(scope="function")
def base_url() -> str:
    """Base URL for the application."""
    return "http://localhost:3000"  # Your custom URL
```

## Debugging Tests

### Take screenshots on failure:

Playwright automatically captures screenshots and videos on test failures in the `test-results/` directory.

### Debug mode:

```bash
# Run in debug mode with Playwright Inspector
PWDEBUG=1 uv run pytest tests/e2e/test_app.py::test_loads_main_ui
```

### Trace viewer:

```bash
# Generate trace files
uv run pytest tests/e2e/ --tracing on

# View traces
playwright show-trace test-results/.../trace.zip
```

## CI/CD Integration

E2E tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Install Playwright
  run: |
    pip install -e ".[dev]"
    playwright install chromium --with-deps

- name: Start application
  run: |
    uvicorn main:app --host 0.0.0.0 --port 8000 &
    sleep 5

- name: Run E2E tests
  run: pytest tests/e2e/ --headed=false --browser chromium
```

## Markers

Tests are marked with pytest markers for easy filtering:

- `@pytest.mark.e2e` - All E2E tests

Example:
```python
@pytest.mark.e2e
class TestApplicationLoading:
    def test_loads_main_ui(self, page: Page, base_url: str):
        ...
```

## Helper Functions

The `helpers.py` module provides reusable functions:

- `wait_for_app_load()` - Wait for all API responses
- `click_tree_node()` - Click a tree node by name
- `expand_tree_node()` - Expand a tree node
- `get_first_input()` - Get first input of specific type
- `save_data()` - Click save button and wait for response
- `reset_data()` - Click reset button
- `switch_theme()` - Switch theme (light/dark/system)
- And many more...

## Troubleshooting

### Port already in use:
If port 8000 is already in use, either:
1. Stop the conflicting process
2. Change the port in the application
3. Update the `base_url` fixture

### Browser not installed:
```bash
playwright install chromium
```

### Tests timing out:
Increase timeout in `conftest.py`:
```python
@pytest.fixture(scope="session")
def browser_context_args(browser_context_args: dict) -> dict:
    return {
        **browser_context_args,
        "viewport": {"width": 1280, "height": 720},
        "timeout": 60000,  # Increase to 60 seconds
    }
```

### Tests failing intermittently:
Add more waits in tests:
```python
page.wait_for_timeout(1000)  # Wait 1 second
page.wait_for_load_state("networkidle")  # Wait for network to be idle
```

## Best Practices

1. **Wait for page to load** before interacting with elements
2. **Use data-testid** attributes for reliable selectors
3. **Handle conditional elements** with visibility checks
4. **Clean up state** between tests using fixtures
5. **Use helper functions** for common operations
6. **Add meaningful assertions** to verify behavior
7. **Keep tests independent** - each test should work standalone
8. **Use descriptive names** for test methods

## Contributing

When adding new E2E tests:

1. Follow the existing test structure
2. Add helper functions to `helpers.py` for reusable operations
3. Use pytest markers appropriately
4. Add docstrings to test classes and methods
5. Test both positive and negative scenarios
6. Consider mobile/responsive layouts
7. Update this README with new test coverage

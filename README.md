<p align="center">
<img src="https://raw.githubusercontent.com/idling-mind/pydantic-ui/refs/heads/main/frontend/public/logo.png" height=100>
<h1 align="center">PydanticUI</h1>
</p>

A dynamic, modern UI for editing deeply nested Pydantic models with FastAPI integration.

> [!NOTE]
> This project is not associated with the pydantic project.
> The code was primarily written using AI coding agents.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![FastAPI](https://img.shields.io/badge/fastapi-0.100+-green.svg)
![Pydantic](https://img.shields.io/badge/pydantic-v2-green.svg)

![Screenshot](https://raw.githubusercontent.com/idling-mind/pydantic-ui/refs/heads/main/screenshot.png)

## Features

- 🌳 **Tree Navigation**: Sidebar showing hierarchical structure of nested models
- 🎨 **Dynamic Renderers**: Auto-detect appropriate input components based on field types
- ⚙️ **Customizable**: Override default renderers with sliders, dropdowns, date pickers, etc.
- 🌓 **Theme Support**: Light and dark mode with system preference detection
- ✅ **Validation**: Real-time validation using Pydantic validators
- 📦 **Easy Integration**: Mount as a FastAPI router in your existing application
- 🔘 **Action Buttons**: Custom action buttons with Python callbacks
- 📡 **Real-time Updates**: Server-Sent Events (SSE) for live UI updates
- 💾 **Session Management**: Per-user session state with data persistence
- 📋 **Copy/Paste**: Clipboard support for tree nodes

## Installation

```bash
pip install pydantic-ui
```

## Quick Start

```python
from fastapi import FastAPI
from pydantic import BaseModel, Field
from pydantic_ui import create_pydantic_ui, FieldConfig, Renderer, UIConfig


# Define your Pydantic model
class Address(BaseModel):
    street: str
    city: str
    zipcode: str


class Person(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(gt=0, lt=150)
    email: str
    address: Address = Field(description="Permanent address")
    tags: list[str] = []


# Field-specific configurations (alternative to annotations)
field_configs = {
    "age": FieldConfig(
        label="User Age",
        renderer=Renderer.SLIDER,
    )
}
# Create FastAPI app and mount pydantic-ui
app = FastAPI()

app.include_router(
    create_pydantic_ui(
        Person,
        prefix="/editor",
        field_configs=field_configs,
        ui_config=UIConfig(title="Person Editor", show_save_reset=True),
    ),
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

Then visit `http://localhost:8000/editor` to see the UI.

## Public API

The package exports the following from `pydantic_ui`:

| Export | Description |
|--------|-------------|
| `create_pydantic_ui` | Factory function to create a FastAPI router for a Pydantic model |
| `UIConfig` | Global UI configuration class |
| `FieldConfig` | Per-field UI configuration class |
| `Renderer` | Enum of available field renderers |
| `ActionButton` | Configuration for custom action buttons |
| `PydanticUIController` | Controller for programmatic UI interaction |

## UI Configuration

### Global Configuration (`UIConfig`)

All available options for `UIConfig`:

```python
from pydantic_ui import create_pydantic_ui, UIConfig

ui_config = UIConfig(
    # Basic Settings
    title="Data Editor",              # Title shown in header (default: "Data Editor")
    description="",                   # Description below title
    
    # Logo/Branding
    logo_text=None,                   # Short text for logo (e.g., "P", "UI"). 
                                      # If not set, uses first letter of title
    logo_url=None,                    # URL to logo image. Overrides logo_text if set
    
    # Theme
    theme="system",                   # "light", "dark", or "system" (default: "system")
    
    # Form Behavior
    read_only=False,                  # Make entire form read-only (default: False)
    show_validation=True,             # Show validation errors (default: True)
    auto_save=False,                  # Auto-save changes (default: False)
    auto_save_delay=1000,             # Delay in ms before auto-saving (default: 1000)
    
    # Tree Panel
    collapsible_tree=True,            # Allow tree nodes to collapse (default: True)
    show_types=True,                  # Show type badges in tree (default: True)
    
    # Footer
    show_save_reset=False,            # Show Save/Reset buttons in footer (default: False)
    footer_text="Powered by Pydantic UI",  # Footer text (empty string hides footer)
    footer_url="https://github.com/idling-mind/pydantic-ui",  # Footer link URL
    
    # Layout
    responsive_columns={              # Responsive column breakpoints
        640: 1,                       # 1 column up to 640px
        1000: 2,                      # 2 columns from 640-1000px  
        1600: 3                       # 3 columns above 1000px
    },
    
    # Custom Actions (see Action Buttons section)
    actions=[],                       # List of ActionButton configurations
)

app.include_router(
    create_pydantic_ui(
        Person,
        ui_config=ui_config,
        prefix="/editor"
    ),
)
```

### Per-Field Configuration (`FieldConfig`)

Use `Annotated` with `FieldConfig` to customize individual fields:

```python
from typing import Annotated
from pydantic_ui import FieldConfig, Renderer

class Settings(BaseModel):
    # Slider for numeric values
    volume: Annotated[int, FieldConfig(
        renderer=Renderer.SLIDER,
        label="Volume Level",          # Custom label (defaults to field name)
        help_text="Adjust the volume", # Help text below field (alias: description)
        placeholder="Enter value",     # Placeholder text
        props={"min": 0, "max": 100, "step": 5}  # Renderer-specific props
    )] = 50
    
    # Dropdown for enum-like fields
    theme: Annotated[str, FieldConfig(
        renderer=Renderer.SELECT,
        props={"options": ["light", "dark", "auto"]}
    )] = "auto"
    
    # Toggle instead of checkbox
    notifications: Annotated[bool, FieldConfig(
        renderer=Renderer.TOGGLE
    )] = True
    
    # Text area for long text
    bio: Annotated[str, FieldConfig(
        renderer=Renderer.TEXT_AREA,
        props={"rows": 5, "placeholder": "Tell us about yourself..."}
    )] = ""
    
    # Hidden fields (not shown in UI)
    internal_id: Annotated[str, FieldConfig(hidden=True)]
    
    # Read-only fields (visible but not editable)
    created_at: Annotated[str, FieldConfig(read_only=True)]
```

### Class-Based Configuration

You can configure specific classes globally using `class_configs` in `UIConfig`. This is useful when you want to apply the same configuration to a type wherever it appears in your model hierarchy.

```python
from typing import NewType
from enum import Enum
from pydantic_ui import UIConfig, FieldConfig, Renderer

# Define custom types
Email = NewType('Email', str)

class Color(str, Enum):
    RED = "red"
    BLUE = "blue"

# Configure them globally
ui_config = UIConfig(
    class_configs={
        "Email": FieldConfig(
            renderer=Renderer.EMAIL,
            placeholder="user@example.com",
            help_text="Enter a valid email address"
        ),
        "Color": FieldConfig(
            renderer=Renderer.SELECT,
            label="Pick a color"
        )
    }
)

# Now any field of type Email or Color will use these configs automatically
class User(BaseModel):
    primary_email: Email  # Uses global Email config
    backup_email: Email   # Uses global Email config
    favorite_color: Color # Uses global Color config
    
    # You can still override specific instances using Annotated
    admin_email: Annotated[Email, FieldConfig(label="Admin Contact")]
```

### Field Configs via Path (Alternative Method)

You can also configure fields by path without using `Annotated`:

```python
field_configs = {
    # Direct field path
    "server.name": FieldConfig(
        label="Application Name",
        placeholder="Enter your app name",
    ),
    
    # Array item fields using [] syntax
    "users.[].age": FieldConfig(
        label="User Age",
        renderer=Renderer.SLIDER,
        props={"min": 0, "max": 120, "step": 1},
    ),
    
    # Nested paths
    "database.password": FieldConfig(
        label="Database Password",
        props={"type": "password"},
    ),
}

pydantic_ui_router = create_pydantic_ui(
    model=AppConfig,
    field_configs=field_configs,
    prefix="/config",
)
```

### Available Renderers

| Renderer | Enum Value | Description | Props |
|----------|------------|-------------|-------|
| Auto | `Renderer.AUTO` | Auto-detect based on type | - |
| Text Input | `Renderer.TEXT_INPUT` | Single-line text input | `placeholder`, `maxLength` |
| Text Area | `Renderer.TEXT_AREA` | Multi-line text input | `rows`, `placeholder` |
| Number Input | `Renderer.NUMBER_INPUT` | Numeric input | `min`, `max`, `step` |
| Slider | `Renderer.SLIDER` | Range slider | `min`, `max`, `step`, `marks` |
| Checkbox | `Renderer.CHECKBOX` | Checkbox | - |
| Toggle | `Renderer.TOGGLE` | Toggle switch | - |
| Select | `Renderer.SELECT` | Dropdown select | `options` |
| Multi-Select | `Renderer.MULTI_SELECT` | Multi-select dropdown | `options` |
| Date Picker | `Renderer.DATE_PICKER` | Date picker | `format` |
| DateTime Picker | `Renderer.DATETIME_PICKER` | DateTime picker | `format` |
| Color Picker | `Renderer.COLOR_PICKER` | Color picker | - |
| File Upload | `Renderer.FILE_UPLOAD` | File upload | - |
| File Select | `Renderer.FILE_SELECT` | File selector | - |
| Password | `Renderer.PASSWORD` | Password input | - |
| Email | `Renderer.EMAIL` | Email input | - |
| URL | `Renderer.URL` | URL input | - |

## Action Buttons

Add custom action buttons to the UI header that trigger Python callbacks:

### Defining Action Buttons

```python
from pydantic_ui import UIConfig, ActionButton

ui_config = UIConfig(
    title="App Settings",
    actions=[
        ActionButton(
            id="validate",             # Unique identifier (required)
            label="Validate",          # Button label (required)
            variant="secondary",       # "default", "secondary", "outline", 
                                       # "ghost", "destructive"
            icon="check-circle",       # Lucide icon name (optional)
            tooltip="Run validation",  # Tooltip on hover (optional)
            disabled=False,            # Whether button is disabled
            confirm=None,              # Confirmation message before action
                                       # If set, shows dialog before triggering
        ),
        ActionButton(
            id="reset",
            label="Reset All",
            variant="destructive",
            icon="refresh-cw",
            confirm="Are you sure you want to reset all settings?"
        ),
        ActionButton(
            id="save",
            label="Save",
            variant="default",
            icon="save",
        ),
    ],
)
```

### Registering Action Handlers

```python
from pydantic_ui import create_pydantic_ui, PydanticUIController

router = create_pydantic_ui(model=AppSettings, ui_config=ui_config, prefix="/settings")
app.include_router(router)

@router.action("validate")
async def handle_validate(data: dict, controller: PydanticUIController):
    """Handler receives current data and a controller for UI interaction."""
    errors = []
    
    # Custom validation logic
    if data.get("environment") == "production" and data.get("server", {}).get("debug"):
        errors.append({
            "path": "server.debug",
            "message": "Debug mode should not be enabled in production"
        })
    
    if errors:
        await controller.show_validation_errors(errors)
        await controller.show_toast("Validation failed", "error")
    else:
        await controller.clear_validation_errors()
        await controller.show_toast("All validations passed!", "success")
    
    return {"valid": len(errors) == 0}

@router.action("save")
async def handle_save(data: dict, controller: PydanticUIController):
    """Save handler with Pydantic validation."""
    from pydantic import ValidationError
    
    try:
        validated = AppSettings.model_validate(data)
        # Save to database, file, etc.
        await controller.show_toast("Settings saved!", "success")
        return {"saved": True}
    except ValidationError as e:
        await controller.show_toast(f"Validation error: {e}", "error")
        return {"saved": False}
```

## Controller Methods (`PydanticUIController`)

The controller provides methods for programmatic UI interaction:

### Validation Errors

```python
# Show validation errors
await controller.show_validation_errors([
    {"path": "users[0].age", "message": "Age must be positive"},
    {"path": "name", "message": "Name is required"}
])

# Clear all validation errors
await controller.clear_validation_errors()
```

### Toast Notifications

```python
# Show toast notification
await controller.show_toast(
    message="Operation completed!",
    type="success",         # "success", "error", "warning", "info"
    duration=5000           # ms (0 for persistent)
)

# Broadcast toast to ALL connected sessions
await controller.broadcast_toast("Server restarting...", "warning")
```

### Data Updates

```python
# Push new data to the UI
new_data = AppSettings(name="Updated", ...)
await controller.push_data(new_data)  # Accepts BaseModel or dict

# Get current data from session
current_data = controller.get_current_data()

# Get validated model instance (returns None if invalid)
model_instance = controller.get_model_instance()

# Tell UI to refresh from server
await controller.refresh()

# Broadcast refresh to all sessions
await controller.broadcast_refresh()
```

### Confirmation Dialogs

```python
# Request user confirmation (async - waits for response)
confirmed = await controller.request_confirmation(
    message="Delete all users?",
    title="Confirm Deletion",       # Dialog title
    confirm_text="Delete",          # Confirm button text
    cancel_text="Cancel",           # Cancel button text
    variant="destructive"           # "default" or "destructive"
)

if confirmed:
    # User clicked confirm
    delete_all_users()
```

## Data Handlers

### Custom Data Loading and Saving

Use decorators to set custom data loader/saver:

```python
from pydantic_ui import create_pydantic_ui

router = create_pydantic_ui(Person, prefix="/editor")
app.include_router(router)

@router.data_loader
async def load_person() -> Person:
    """Load data from your database or file."""
    return await database.get_person(id=1)

@router.data_saver
async def save_person(data: Person) -> None:
    """Save data to your database or file."""
    await database.update_person(id=1, data=data)
```

### Initial Data via Parameter

```python
initial_person = Person(
    name="John Doe",
    age=30,
    email="john@example.com",
    address=Address(street="123 Main St", city="NYC", zipcode="10001"),
)

app.include_router(
    create_pydantic_ui(
        Person, 
        initial_data=initial_person,
        prefix="/editor"
    ),
)
```

### Inline Data Loader/Saver

```python
app.include_router(
    create_pydantic_ui(
        Person,
        data_loader=lambda: load_from_db(),
        data_saver=lambda data: save_to_db(data),
        prefix="/editor"
    ),
)
```

## Factory Function Reference

Complete signature for `create_pydantic_ui`:

```python
def create_pydantic_ui(
    model: type[BaseModel],           # The Pydantic model class (required)
    *,
    ui_config: UIConfig | None = None,           # Global UI configuration
    field_configs: dict[str, FieldConfig] | None = None,  # Per-field configs by path
    initial_data: BaseModel | None = None,       # Initial data to populate form
    data_loader: Callable[[], BaseModel | dict] | None = None,  # Data loader function
    data_saver: Callable[[BaseModel], None] | None = None,      # Data saver function
    prefix: str = "",                 # URL prefix for router
) -> APIRouter:
    ...
```

The returned router has additional attributes:

| Attribute | Description |
|-----------|-------------|
| `router.controller` | `PydanticUIController` instance |
| `@router.action(id)` | Decorator to register action handlers |
| `@router.data_loader` | Decorator to set custom data loader |
| `@router.data_saver` | Decorator to set custom data saver |

## API Endpoints

When mounted at `/editor`, the following endpoints are available:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/editor/` | Serve the React UI |
| GET | `/editor/api/schema` | Get the model schema |
| GET | `/editor/api/data` | Get current session data |
| POST | `/editor/api/data` | Update entire data (validates with Pydantic) |
| PATCH | `/editor/api/data` | Partial update (path + value) |
| POST | `/editor/api/validate` | Validate data without saving |
| GET | `/editor/api/config` | Get UI configuration |
| GET | `/editor/api/session` | Get or create session ID |
| GET | `/editor/api/events` | SSE endpoint for real-time events |
| GET | `/editor/api/events/poll` | Polling fallback for events |
| POST | `/editor/api/actions/{id}` | Trigger action handler |
| POST | `/editor/api/confirmation/{id}` | Handle confirmation response |

## Supported Pydantic Types

The UI automatically handles these types:

| Type | Renderer |
|------|----------|
| `str` | Text Input |
| `int`, `float` | Number Input (Slider if min/max defined) |
| `bool` | Toggle |
| `datetime`, `date` | Date/DateTime Picker |
| `Enum`, `StrEnum` | Select Dropdown |
| `Literal["a", "b"]` | Select Dropdown |
| `list[T]` | Array Editor with add/remove |
| `dict[str, T]` | JSON Editor or Key-Value |
| `Optional[T]` / `T \| None` | Nullable field |
| Nested `BaseModel` | Nested object navigation |

## Examples

See the [examples](./examples/) directory for complete examples:

- **[simple.py](./examples/basic/simple.py)** - Basic usage with field configs
- **[main.py](./examples/basic/main.py)** - Full configuration example
- **[callbacks.py](./examples/basic/callbacks.py)** - Action buttons, validation, toasts, confirmations

### Running Examples

```bash
# Run the simple example
cd examples/basic
python simple.py
# Visit http://localhost:8000/config

# Run the callbacks example
python callbacks.py
# Visit http://localhost:8000/settings
```

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/idling-mind/pydantic-ui.git
cd pydantic-ui

# Install dependencies
pip install -e ".[dev]"

# Install frontend dependencies
cd frontend
npm install
```

### Running Tests

```bash
# Backend tests
pytest

# Frontend tests
cd frontend
npm test
```

### Building

```bash
# Build frontend and copy to package
cd frontend
npm run build:package

# Or use the PowerShell script (Windows)
./scripts/build-test.ps1

# Build Python package
python -m build
```

### Build Script Options

```powershell
# Full build and run
./scripts/build-test.ps1

# Skip frontend build (use existing)
./scripts/build-test.ps1 -SkipBuild

# Run specific example on different port
./scripts/build-test.ps1 -Example callbacks -Port 3000 -OpenBrowser
```

## License

MIT License - see [LICENSE](LICENSE) for details.

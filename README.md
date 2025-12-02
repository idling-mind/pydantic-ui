# Pydantic UI

A dynamic, modern UI for editing deeply nested Pydantic models with FastAPI integration.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![FastAPI](https://img.shields.io/badge/fastapi-0.100+-green.svg)
![Pydantic](https://img.shields.io/badge/pydantic-v2-green.svg)

## Features

- 🌳 **Tree Navigation**: Sidebar showing hierarchical structure of nested models
- 🎨 **Dynamic Renderers**: Auto-detect appropriate input components based on field types
- ⚙️ **Customizable**: Override default renderers with sliders, dropdowns, date pickers, etc.
- 🌓 **Theme Support**: Light and dark mode with system preference detection
- ✅ **Validation**: Real-time validation using Pydantic validators
- 📦 **Easy Integration**: Mount as a FastAPI router in your existing application

## Installation

```bash
pip install pydantic-ui
```

## Quick Start

```python
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Annotated
from pydantic_ui import create_pydantic_ui, FieldConfig, Renderer

# Define your Pydantic model
class Address(BaseModel):
    street: str
    city: str
    zipcode: str

class Person(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    age: Annotated[int, FieldConfig(
        renderer=Renderer.SLIDER,
        props={"min": 0, "max": 120}
    )]
    email: str
    address: Address
    tags: list[str] = []

# Create FastAPI app and mount pydantic-ui
app = FastAPI()

app.include_router(
    create_pydantic_ui(Person, prefix="/editor"),
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

Then visit `http://localhost:8000/editor` to see the UI.

## UI Configuration

### Global Configuration

```python
from pydantic_ui import create_pydantic_ui, UIConfig

app.include_router(
    create_pydantic_ui(
        Person,
        ui_config=UIConfig(
            title="Person Editor",
            description="Edit person details",
            theme="system",  # "light", "dark", or "system"
            read_only=False,
            show_validation=True,
        ),
        prefix="/editor"
    ),
)
```

### Per-Field Configuration

Use `Annotated` with `FieldConfig` to customize individual fields:

```python
from typing import Annotated
from pydantic_ui import FieldConfig, Renderer

class Settings(BaseModel):
    # Slider for numeric values
    volume: Annotated[int, FieldConfig(
        renderer=Renderer.SLIDER,
        label="Volume Level",
        help_text="Adjust the volume",
        props={"min": 0, "max": 100, "step": 5}
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
    
    # Hidden fields
    internal_id: Annotated[str, FieldConfig(hidden=True)]
    
    # Read-only fields
    created_at: Annotated[str, FieldConfig(read_only=True)]
```

### Available Renderers

| Renderer | Description | Props |
|----------|-------------|-------|
| `auto` | Auto-detect based on type | - |
| `text_input` | Standard text input | `placeholder`, `maxLength` |
| `text_area` | Multi-line text | `rows`, `placeholder` |
| `number_input` | Numeric input | `min`, `max`, `step` |
| `slider` | Slider control | `min`, `max`, `step`, `marks` |
| `checkbox` | Checkbox | - |
| `toggle` | Toggle switch | - |
| `select` | Dropdown select | `options` |
| `multi_select` | Multi-select | `options` |
| `date_picker` | Date picker | `format` |
| `color_picker` | Color picker | - |
| `password` | Password input | - |
| `email` | Email input | - |
| `url` | URL input | - |

## Data Handlers

### Custom Data Loading and Saving

```python
from pydantic_ui import create_pydantic_ui

pydantic_ui = create_pydantic_ui(Person, prefix="/editor")
app.include_router(pydantic_ui)

@pydantic_ui.data_loader
async def load_person() -> Person:
    """Load data from your database or file."""
    return await database.get_person(id=1)

@pydantic_ui.data_saver
async def save_person(data: Person) -> None:
    """Save data to your database or file."""
    await database.update_person(id=1, data=data)
```

### Initial Data

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

## API Endpoints

When mounted at `/editor`, the following endpoints are available:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/editor/` | Serve the React UI |
| GET | `/editor/api/schema` | Get the model schema |
| GET | `/editor/api/data` | Get current data |
| POST | `/editor/api/data` | Update data |
| PATCH | `/editor/api/data` | Partial update |
| POST | `/editor/api/validate` | Validate without saving |
| GET | `/editor/api/config` | Get UI configuration |

## Examples

See the [examples](./examples/) directory for more complete examples:

- [Basic Usage](./examples/basic/)
- [Custom Renderers](./examples/custom_renderers/)
- [Complex Nested Models](./examples/complex_models/)

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/pydantic-ui.git
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
# Build frontend
cd frontend
npm run build:package

# Build Python package
python -m build
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.

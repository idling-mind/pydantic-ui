# API Migration Guide

This guide helps you migrate from older versions of pydantic-ui to the current API (v0.4.0+).

## Breaking Changes

### 1. FieldConfig: Display Properties Moved to DisplayConfig

**Old API** (pre-v0.4.0):
```python
from pydantic_ui import FieldConfig, Renderer

age: Annotated[int, FieldConfig(
    renderer=Renderer.SLIDER,
    title="User Age",              # ❌ No longer valid
    subtitle="Age in years",       # ❌ No longer valid
    help_text="Enter your age",    # ❌ No longer valid
    props={"min": 0, "max": 120}
)]
```

**New API** (v0.4.0+):
```python
from pydantic_ui import FieldConfig, DisplayConfig, Renderer

age: Annotated[int, FieldConfig(
    renderer=Renderer.SLIDER,
    display=DisplayConfig(         # ✅ Use DisplayConfig
        title="User Age",
        subtitle="Age in years",
        help_text="Enter your age"
    ),
    props={"min": 0, "max": 120}
)]
```

### 2. New Exports: DisplayConfig and ViewDisplay

You must now import `DisplayConfig` when customizing field display:

```python
from pydantic_ui import (
    create_pydantic_ui,
    UIConfig,
    FieldConfig,
    DisplayConfig,      # ✅ New export
    ViewDisplay,        # ✅ New export (for per-view overrides)
    Renderer,
    ActionButton,
)
```

### 3. Per-View Display Overrides

The new API supports different display properties for different views:

```python
from pydantic_ui import DisplayConfig, ViewDisplay

FieldConfig(
    display=DisplayConfig(
        title="Database Connection Settings",
        subtitle="Primary database configuration",
        
        # Override display for tree view (shorter)
        tree=ViewDisplay(title="Database"),
        
        # Override for detail panel
        detail=ViewDisplay(
            title="DB Settings",
            subtitle="Configure database connection"
        ),
        
        # Override for table columns
        table=ViewDisplay(title="DB"),
        
        # Override for cards (array items)
        card=ViewDisplay(title="{name} - {host}")
    )
)
```

### 4. UIConfig: class_configs and attr_configs

These now use the new `FieldConfig` structure:

**Old API**:
```python
UIConfig(
    field_configs={
        "database.host": {
            "title": "Database Host",    # ❌ Old structure
            "renderer": "text_input"
        }
    }
)
```

**New API**:
```python
UIConfig(
    attr_configs={                       # ✅ Renamed from field_configs
        "database.host": FieldConfig(
            display=DisplayConfig(       # ✅ Use DisplayConfig
                title="Database Host"
            ),
            renderer=Renderer.TEXT_INPUT
        )
    }
)
```

## Migration Steps

### Step 1: Update Imports

Add new imports:
```python
from pydantic_ui import DisplayConfig, ViewDisplay
```

### Step 2: Update FieldConfig Annotations

Find all `FieldConfig` usages with `title`, `subtitle`, or `help_text` and wrap them in `DisplayConfig`:

```python
# Before
FieldConfig(title="My Field", subtitle="Help text")

# After
FieldConfig(display=DisplayConfig(title="My Field", subtitle="Help text"))
```

### Step 3: Update UIConfig

If you use `field_configs` in `UIConfig`, rename to `attr_configs` and update structure:

```python
# Before
ui_config = UIConfig(
    field_configs={
        "name": {"title": "User Name"}
    }
)

# After
ui_config = UIConfig(
    attr_configs={
        "name": FieldConfig(
            display=DisplayConfig(title="User Name")
        )
    }
)
```

### Step 4: Update class_configs

Similar to attr_configs:

```python
# Before
UIConfig(
    class_configs={
        "Email": {"renderer": "email"}
    }
)

# After
UIConfig(
    class_configs={
        "Email": FieldConfig(
            renderer=Renderer.EMAIL
        )
    }
)
```

## Quick Migration Script

Here's a regex pattern to help find code that needs updating:

```regex
# Find FieldConfig with direct title/subtitle/help_text
FieldConfig\([^)]*\b(title|subtitle|help_text)\s*=
```

## Benefits of New API

The new API provides:

1. **Cleaner separation** between display and behavior configuration
2. **Per-view customization** - different displays for tree, detail, table, card views
3. **Template support** - use `{field_name}` syntax in titles/subtitles for dynamic display
4. **Better type safety** - DisplayConfig and ViewDisplay are proper dataclasses
5. **More flexible** - easier to extend with new display properties

## Example: Full Migration

### Before (Old API)
```python
from pydantic import BaseModel, Field
from pydantic_ui import create_pydantic_ui, UIConfig, FieldConfig, Renderer

class Database(BaseModel):
    host: Annotated[str, FieldConfig(
        title="Database Host",
        subtitle="Server hostname",
        renderer=Renderer.TEXT_INPUT
    )]
    port: Annotated[int, FieldConfig(
        title="Port",
        renderer=Renderer.NUMBER_INPUT
    )]

app.include_router(
    create_pydantic_ui(
        Database,
        ui_config=UIConfig(
            field_configs={
                "host": {"placeholder": "localhost"}
            }
        )
    )
)
```

### After (New API)
```python
from pydantic import BaseModel, Field
from pydantic_ui import (
    create_pydantic_ui,
    UIConfig,
    FieldConfig,
    DisplayConfig,
    ViewDisplay,
    Renderer
)

class Database(BaseModel):
    host: Annotated[str, FieldConfig(
        display=DisplayConfig(
            title="Database Host",
            subtitle="Server hostname",
            tree=ViewDisplay(title="Host")  # Shorter in tree
        ),
        renderer=Renderer.TEXT_INPUT
    )]
    port: Annotated[int, FieldConfig(
        display=DisplayConfig(
            title="Port",
            tree=ViewDisplay(title="Port #")
        ),
        renderer=Renderer.NUMBER_INPUT
    )]

app.include_router(
    create_pydantic_ui(
        Database,
        ui_config=UIConfig(
            attr_configs={
                "host": FieldConfig(
                    placeholder="localhost"
                )
            }
        )
    )
)
```

## Need Help?

- Check the [examples directory](../examples/) for working examples
- See [README.md](../README.md) for full API documentation
- Open an issue on GitHub if you encounter migration problems

## Version Compatibility

- **v0.4.0+**: Current API with DisplayConfig
- **v0.3.x and earlier**: Old API (deprecated)

We recommend upgrading to the latest version to take advantage of new features and improvements.

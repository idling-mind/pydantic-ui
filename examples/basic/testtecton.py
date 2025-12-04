"""
Example: Basic usage of pydantic-ui

This example shows how to create a simple data editing UI for a configuration model.
"""

# Import pydantic_ui components
import sys
from datetime import date, datetime
from typing import Annotated, Literal, Optional

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel, Field, ValidationError

from pydantic_ui.config import ActionButton
from pydantic_ui.controller import PydanticUIController
from user_input import UserInput

sys.path.insert(0, str(__file__).replace("\\", "/").rsplit("/", 3)[0])

from pydantic_ui import FieldConfig, Renderer, UIConfig, create_pydantic_ui

# Create FastAPI app
app = FastAPI(title="Pydantic UI Example")

# Configure UI
ui_config = UIConfig(
    title="Tecton user input configuration",
    description="Edit the configuration for your Tecton weld analysis below.",
    collapsible_tree=True,
    show_validation=True,
    actions=[
        ActionButton(
            id="validate",
            label="Validate",
            variant="secondary",
            icon="check-circle",
            tooltip="Run custom validation"
        ),
        ActionButton(
            id="clear",
            label="Clear",
            variant="destructive",
            icon="refresh",
            tooltip="Clear all data",
            confirm="Are you sure you want to clear all data? This action cannot be undone."
        ),
    ]
)

# Field-specific configurations (alternative to annotations)
field_configs = {
    "analysis": FieldConfig(
        label="Analysis Inputs",
        description="Specify the analysis type and parameters here.",
    ),
    "advanced_settings.cores": FieldConfig(
        label="Number of CPU Cores",
        renderer=Renderer.SLIDER,
        props={"min": 0, "max": 30, "step": 1},
    ),
}

# Create and mount the pydantic-ui router
pydantic_ui_router = create_pydantic_ui(
    model=UserInput,
    ui_config=ui_config,
    field_configs=field_configs,
    prefix="/config",
)

app.include_router(pydantic_ui_router)

# Custom action handlers using the decorator
@pydantic_ui_router.action("validate")
async def handle_validate(data: dict, controller: PydanticUIController):
    """
    Full Pydantic validation + custom business rules.
    
    This demonstrates how to:
    1. Run Pydantic's built-in validation (type checks, constraints like ge/le, etc.)
    2. Add custom business rule validation on top
    3. Convert all errors to the UI format
    """
    errors = []
    
    # Step 1: Run Pydantic's built-in validation
    try:
        # This validates all field types, constraints (ge, le, min_length, etc.)
        validated = UserInput.model_validate(data)
    except ValidationError as e:
        # Convert Pydantic validation errors to UI format
        for error in e.errors():
            # error['loc'] is a tuple like ('server', 'port') - join with dots
            path = ".".join(str(loc) for loc in error['loc'])
            errors.append({
                "path": path,
                "message": error['msg']
            })
    except Exception as e:
        await controller.show_toast(f"Unexpected error: {e}", "error")
        return {"valid": False, "error_count": 1}
    # Step 3: Show results in the UI
    if errors:
        print(errors)
        await controller.show_validation_errors(errors)
        await controller.show_toast(
            f"Validation failed with {len(errors)} error(s)",
            "error"
        )
        return {"valid": False, "error_count": len(errors)}
    else:
        await controller.clear_validation_errors()
        await controller.push_data(validated)
        await controller.show_toast("All validations passed!", "success")
        return {"valid": True}

@pydantic_ui_router.action("clear")
async def handle_clear(data: dict, controller: PydanticUIController):
    """
    Clear all data and reset to original configuration.
    """
    await controller.push_data({})
    await controller.show_toast("Cleared all data", "success")
    return {"cleared": True}


# Custom endpoint to demonstrate data handling
@app.get("/api/current-config")
async def get_current_config():
    """Get the current configuration (from pydantic-ui's data handler)"""
    # Access the data handler from the router
    return {"message": "Use /config/api/data to get the configuration"}


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Pydantic UI Example - Configuration Editor")
    print("=" * 60)
    print("\nOpen your browser at: http://localhost:8000/config")
    print("\nAPI Endpoints:")
    print("  - GET  /config/api/schema  - Get the UI schema")
    print("  - GET  /config/api/data    - Get current data")
    print("  - PUT  /config/api/data    - Update data")
    print("  - POST /config/api/validate - Validate data")
    print("=" * 60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)

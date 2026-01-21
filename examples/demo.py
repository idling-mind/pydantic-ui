# Import pydantic_ui components
import sys
from datetime import datetime, timedelta

import uvicorn
from fastapi import FastAPI
from nested import DeepNestedModel
from pydantic_core import ValidationError

sys.path.insert(0, str(__file__).replace("\\", "/").rsplit("/", 3)[0])

from pydantic_ui import (
    ActionButton,
    FieldConfig,
    PydanticUIController,
    Renderer,
    UIConfig,
    create_pydantic_ui,
)

# Create FastAPI app
app = FastAPI(title="Pydantic UI Example")

# Configure UI
ui_config = UIConfig(
    title="Pydantic UI example - Deeply nested model",
    description="Edit the fields of the deeply nested model below.",
    collapsible_tree=True,
    show_validation=True,
    actions=[
        ActionButton(
            id="validate",
            label="Validate",
            variant="secondary",
            icon="check-circle",
            tooltip="Run custom validation",
        ),
        ActionButton(
            id="clear",
            label="Clear",
            variant="destructive",
            icon="refresh",
            tooltip="Clear all data",
            confirm="Are you sure you want to clear all data? This action cannot be undone.",
        ),
        ActionButton(
            id="save",
            label="Save",
            icon="save",
            tooltip="Save all data",
            confirm="Are you sure you want to save all data?",
        ),
    ],
    attr_configs={
        "created_at": FieldConfig(
            label="Created Date",
            placeholder="Select a date",
            renderer=Renderer.DATE_PICKER,
        ),
        "contacts.[].value": FieldConfig(
            label="Value of the type",
            description="The value associated with the contact type",
        ),
        "contacts.[].photo": FieldConfig(
            label="Photo",
            description="Path to the contact's photo",
            renderer=Renderer.FILE_UPLOAD,
        ),
    },
)

# Create and mount the pydantic-ui router
pydantic_ui_router = create_pydantic_ui(
    model=DeepNestedModel,
    ui_config=ui_config,
    prefix="/config",
)


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
        validated = DeepNestedModel.model_validate(data)
    except ValidationError as e:
        # Convert Pydantic validation errors to UI format
        for error in e.errors():
            # error['loc'] is a tuple like ('server', 'port') - join with dots
            path = ".".join(str(loc) for loc in error["loc"])
            errors.append({"path": path, "message": error["msg"]})
    except Exception as e:
        await controller.show_toast(f"Unexpected error: {e}", "error")
        return {"valid": False, "error_count": 1}
    # Custom validation
    try:
        if validated.created_at > datetime.now().date():
            errors.append(
                {"path": "created_at", "message": "Created date cannot be in the future."}
            )
        if (
            validated.created_at < datetime.now().date() - timedelta(days=7)
            and validated.optional_field is None
        ):
            print(" and and here")
            errors.append(
                {
                    "path": "optional_field",
                    "message": "Optional field must be set if created date is older than 7 days.",
                }
            )
    except Exception as e:
        await controller.show_toast(f"Unexpected error during custom validation: {e}", "error")
    # Step 3: Show results in the UI
    if errors:
        await controller.show_validation_errors(errors)
        await controller.show_toast(f"Validation failed with {len(errors)} error(s)", "error")
        return {"valid": False, "error_count": len(errors)}
    else:
        await controller.clear_validation_errors()
        await controller.show_toast("All validations passed!", "success")
        return {"valid": True}


@pydantic_ui_router.action("clear")
async def handle_clear(data: dict, controller: PydanticUIController):  # noqa: ARG001
    """
    Clear all data and reset to original configuration.
    """
    await controller.push_data({})
    await controller.show_toast("Cleared all data", "success")
    return {"cleared": True}


@pydantic_ui_router.action("save")
async def handle_save(data: dict, controller: PydanticUIController):
    """
    Clear all data and reset to original configuration.
    """
    await controller.push_data(data)
    await controller.show_toast("Saved all data", "success")
    return {"saved": True}


app.include_router(pydantic_ui_router)


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

"""
Example: Custom Callbacks and Actions in pydantic-ui

This example demonstrates how to use:
- Custom action buttons in the UI
- Programmatic validation errors
- Toast notifications
- Confirmation dialogs
- Push data updates from Python
"""

import sys
from typing import Literal

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel, Field, ValidationError

sys.path.insert(0, str(__file__).replace("\\", "/").rsplit("/", 3)[0])

# Import pydantic_ui components
from pydantic_ui import (
    ActionButton,
    PydanticUIController,
    UIConfig,
    create_pydantic_ui,
)


# Define your Pydantic models
class ServerSettings(BaseModel):
    """Server configuration"""

    host: str = Field(default="localhost", description="Server hostname")
    port: int = Field(default=8080, ge=1, le=65535, description="Server port")
    debug: bool = Field(default=False, description="Enable debug mode")
    workers: int = Field(default=4, ge=1, le=32, description="Number of workers")


class DatabaseSettings(BaseModel):
    """Database configuration"""

    host: str = Field(default="localhost", description="Database host")
    port: int = Field(default=5432, ge=1, le=65535, description="Database port")
    name: str = Field(default="mydb", description="Database name")
    user: str = Field(default="admin", description="Database user")
    password: str = Field(default="", description="Database password")


class AppSettings(BaseModel):
    """Application Settings"""

    app_name: str = Field(default="My Application", description="Application name")
    environment: Literal["development", "staging", "production"] = Field(
        default="development", description="Deployment environment"
    )
    server: ServerSettings = Field(default_factory=ServerSettings)
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    features: dict[str, bool] = Field(
        default={"feature_a": True, "feature_b": False}, description="Feature flags"
    )


# Default templates for different environments
ENVIRONMENT_TEMPLATES = {
    "development": AppSettings(
        app_name="Dev App",
        environment="development",
        server=ServerSettings(host="localhost", port=8080, debug=True, workers=1),
        database=DatabaseSettings(host="localhost", port=5432, name="dev_db", user="dev"),
        features={"feature_a": True, "feature_b": True, "experimental": True},
    ),
    "staging": AppSettings(
        app_name="Staging App",
        environment="staging",
        server=ServerSettings(host="0.0.0.0", port=8080, debug=False, workers=2),
        database=DatabaseSettings(
            host="staging-db.internal", port=5432, name="staging_db", user="staging"
        ),
        features={"feature_a": True, "feature_b": True, "experimental": False},
    ),
    "production": AppSettings(
        app_name="Production App",
        environment="production",
        server=ServerSettings(host="0.0.0.0", port=80, debug=False, workers=8),
        database=DatabaseSettings(
            host="prod-db.internal", port=5432, name="prod_db", user="prod_readonly"
        ),
        features={"feature_a": True, "feature_b": False, "experimental": False},
    ),
}


# Create FastAPI app
app = FastAPI(title="Pydantic UI Callbacks Example")

# Configure UI with custom action buttons
ui_config = UIConfig(
    title="App Settings",
    description="Configure your application with custom actions",
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
            id="load_dev",
            label="Load Dev",
            variant="outline",
            icon="code",
            tooltip="Load development template",
        ),
        ActionButton(
            id="load_prod",
            label="Load Prod",
            variant="outline",
            icon="server",
            tooltip="Load production template",
        ),
        ActionButton(
            id="reset_all",
            label="Reset",
            variant="destructive",
            icon="refresh-cw",
            tooltip="Reset all settings",
            confirm="Are you sure you want to reset all settings to defaults?",
        ),
        ActionButton(
            id="save",
            label="Save",
            variant="default",
            icon="save",
            tooltip="Save all settings",
        ),
    ],
)

# Create and mount the pydantic-ui router
router = create_pydantic_ui(
    model=AppSettings,
    ui_config=ui_config,
    prefix="/settings",
)

app.include_router(router)


# Custom action handlers using the decorator
@router.action("validate")
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
        AppSettings.model_validate(data)
    except ValidationError as e:
        # Convert Pydantic validation errors to UI format
        for error in e.errors():
            # error['loc'] is a tuple like ('server', 'port') - join with dots
            path = ".".join(str(loc) for loc in error["loc"])
            errors.append({"path": path, "message": error["msg"]})

    # Step 2: Add custom business rule validation (only if Pydantic validation passed)
    if not errors:
        # Check if production environment has debug enabled
        if data.get("environment") == "production" and data.get("server", {}).get("debug"):
            errors.append(
                {
                    "path": "server.debug",
                    "message": "Debug mode should not be enabled in production",
                }
            )

        # Check if workers are appropriate for environment
        env = data.get("environment")
        workers = data.get("server", {}).get("workers", 1)
        if env == "production" and workers < 4:
            errors.append(
                {
                    "path": "server.workers",
                    "message": "Production environment should have at least 4 workers",
                }
            )

        # Check database password for production
        if env == "production" and not data.get("database", {}).get("password"):
            errors.append(
                {
                    "path": "database.password",
                    "message": "Database password is required for production",
                }
            )

    # Step 3: Show results in the UI
    if errors:
        await controller.show_validation_errors(errors)
        await controller.show_toast(f"Validation failed with {len(errors)} error(s)", "error")
        return {"valid": False, "error_count": len(errors)}
    else:
        await controller.clear_validation_errors()
        await controller.show_toast("All validations passed!", "success")
        return {"valid": True}


@router.action("load_dev")
async def load_dev_template(data: dict, controller: PydanticUIController):  # noqa: ARG001
    """Load development environment template."""
    template = ENVIRONMENT_TEMPLATES["development"]
    await controller.push_data(template)
    await controller.clear_validation_errors()
    await controller.show_toast("Development template loaded", "info")
    return {"loaded": "development"}


@router.action("load_prod")
async def load_prod_template(data: dict, controller: PydanticUIController):  # noqa: ARG001
    """Load production environment template with confirmation."""
    # Request confirmation before applying production settings
    confirmed = await controller.request_confirmation(
        message="This will load production settings. Make sure you understand the implications.",
        title="Load Production Template",
        confirm_text="Load Production",
        cancel_text="Cancel",
        variant="default",
    )

    if confirmed:
        template = ENVIRONMENT_TEMPLATES["production"]
        await controller.push_data(template)
        await controller.clear_validation_errors()
        await controller.show_toast("Production template loaded", "success")
        return {"loaded": "production"}
    else:
        await controller.show_toast("Cancelled loading production template", "info")
        return {"loaded": None, "cancelled": True}


@router.action("reset_all")
async def reset_all_settings(data: dict, controller: PydanticUIController):  # noqa: ARG001
    """Reset all settings to defaults."""
    # The confirm dialog is already shown via the ActionButton.confirm property
    # So we just reset the data here
    default_settings = AppSettings()
    await controller.push_data(default_settings)
    await controller.clear_validation_errors()
    await controller.show_toast("Settings reset to defaults", "info")
    return {"reset": True}


@router.action("save")
async def save_all_settings(data: dict, controller: PydanticUIController):
    """Save all settings."""
    # Implement saving logic here
    try:
        validated_data = AppSettings(**data)
    except Exception as e:
        await controller.show_toast(f"Error saving settings: {e}", "error")
        return {"saved": False, "error": str(e)}

    await controller.push_data(validated_data)
    await controller.show_toast("Settings saved successfully", "success")

    # Run long-running tasks in the background to avoid blocking the response
    # and preventing timeouts
    async def background_tasks():
        import asyncio

        # You can send toasts from background tasks
        await asyncio.sleep(2)

        for i in range(0, 60, 10):
            await controller.show_toast(f"Redirecting in {60 - i} seconds...", "info")
            await asyncio.sleep(10)

        # And navigate
        await controller.navigate_to("api/data", new_tab=True)

    import asyncio

    asyncio.create_task(background_tasks())
    return {"saved": True}


# You can also use the controller directly for other operations
@app.post("/api/deploy")
async def deploy_config():
    """Simulate a deployment that uses the controller."""
    controller = router.controller

    # Get current data
    current_data = controller.get_current_data()

    # Simulate deployment
    await controller.show_toast("Deployment started...", "info", duration=2000)

    # In real app, you'd do actual deployment here
    import asyncio

    await asyncio.sleep(1)

    await controller.show_toast("Deployment completed successfully!", "success")

    return {"status": "deployed", "data": current_data}


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Pydantic UI Callbacks Example")
    print("=" * 60)
    print("\nOpen your browser at: http://localhost:8000/settings")
    print("\nFeatures demonstrated:")
    print("  - Custom action buttons in the header")
    print("  - Programmatic validation errors")
    print("  - Toast notifications")
    print("  - Confirmation dialogs")
    print("  - Push data updates from Python")
    print("\nTry clicking the action buttons to see them in action!")
    print("=" * 60 + "\n")

    uvicorn.run(app, host="0.0.0.0", port=8000)

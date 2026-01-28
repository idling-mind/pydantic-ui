"""
Example: E2E Testing Application

This example provides a predictable configuration for E2E tests.
It includes various field types with known values for reliable testing.
"""

import argparse
import sys
from datetime import date
from typing import Annotated, Literal

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel, Field

sys.path.insert(0, str(__file__).replace("\\", "/").rsplit("/", 3)[0])

from pydantic_ui import (
    ActionButton,
    DisplayConfig,
    FieldConfig,
    Renderer,
    UIConfig,
    create_pydantic_ui,
)

# Enum for testing select fields
try:
    from enum import StrEnum
except ImportError:
    from enum import Enum

    class StrEnum(str, Enum):
        pass


class Priority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Address(BaseModel):
    """Address information"""

    street: str = Field(default="123 Main St", description="Street address")
    city: str = Field(default="Springfield", description="City name")
    zip_code: str = Field(default="12345", description="ZIP/Postal code")


class Person(BaseModel):
    """Person information"""

    name: str = Field(default="John Doe", description="Full name")
    age: Annotated[
        int,
        Field(ge=0, le=150, default=30, description="Age in years"),
        FieldConfig(renderer=Renderer.NUMBER_INPUT),
    ]
    email: str = Field(default="john@example.com", description="Email address")
    address: Address = Field(default_factory=Address, description="Home address")


class Settings(BaseModel):
    """Application settings for testing"""

    # Text fields
    app_name: str = Field(default="Test Application", description="Name of the application")
    description: Annotated[
        str,
        Field(default="A test application for E2E testing", description="App description"),
        FieldConfig(renderer=Renderer.TEXT_AREA, props={"rows": 3}),
    ]

    # Number fields
    port: Annotated[
        int,
        Field(ge=1, le=65535, default=8080, description="Server port"),
        FieldConfig(renderer=Renderer.NUMBER_INPUT),
    ]
    max_connections: Annotated[
        int,
        Field(ge=1, le=1000, default=100, description="Maximum connections"),
        FieldConfig(renderer=Renderer.SLIDER, props={"min": 1, "max": 1000, "step": 10}),
    ]
    timeout: float = Field(default=30.0, ge=0.1, le=300.0, description="Timeout in seconds")

    # Boolean fields
    debug_mode: Annotated[
        bool,
        Field(default=False, description="Enable debug mode"),
        FieldConfig(renderer=Renderer.TOGGLE),
    ]
    enable_logging: Annotated[
        bool,
        Field(default=True, description="Enable logging"),
        FieldConfig(renderer=Renderer.CHECKBOX),
    ]

    # Select/Enum fields
    log_level: Annotated[
        Literal["DEBUG", "INFO", "WARNING", "ERROR"],
        Field(default="INFO", description="Logging level"),
        FieldConfig(renderer=Renderer.SELECT),
    ]
    priority: Priority = Field(default=Priority.MEDIUM, description="Task priority")

    # Date field
    created_date: date = Field(default_factory=date.today, description="Creation date")

    # Nested object
    owner: Person = Field(default_factory=Person, description="Application owner")

    # Array fields
    tags: list[str] = Field(default=["test", "e2e", "example"], description="Application tags")
    users: list[Person] = Field(
        default_factory=lambda: [
            Person(name="Alice Smith", age=25, email="alice@example.com"),
            Person(name="Bob Jones", age=35, email="bob@example.com"),
        ],
        description="List of users",
    )

    # Optional fields
    optional_field: str | None = Field(default=None, description="An optional string field")


# Create FastAPI app
app = FastAPI(title="E2E Test Application")


# Simple action handler for testing
def handle_test_action(data: dict) -> dict:
    """Test action handler."""
    return {"message": "Test action executed successfully", "received_data": data}


# Configure UI
ui_config = UIConfig(
    title="E2E Test Configuration",
    description="Configuration UI for E2E testing",
    collapsible_tree=True,
    show_validation=True,
    show_save_reset=True,
    actions=[
        ActionButton(
            id="test_action",
            label="Test Action",
            description="A test action button",
            handler=handle_test_action,
        ),
    ],
    attr_configs={
        "app_name": FieldConfig(
            placeholder="Enter application name",
            display=DisplayConfig(
                title="Application Name",
                subtitle="The name of your application",
                help_text="This will be displayed in the header",
            ),
        ),
        "owner": FieldConfig(
            display=DisplayConfig(
                title="Owner - {name}",
                subtitle="Application owner information",
            ),
        ),
        "users": FieldConfig(
            display=DisplayConfig(
                title="User List",
                subtitle="All registered users",
            ),
        ),
        "users.[]": FieldConfig(
            display=DisplayConfig(
                title="{name}",
                subtitle="{email}",
            ),
        ),
    },
)

# Create and mount the pydantic-ui router
pydantic_ui_router = create_pydantic_ui(
    model=Settings,
    ui_config=ui_config,
    prefix="/config",
)

app.include_router(pydantic_ui_router)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="E2E Test Application")
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to run the server on (default: 8000)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host to bind to (default: 0.0.0.0)",
    )
    args = parser.parse_args()

    print(f"Starting E2E test app on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port)

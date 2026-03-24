"""
Example: E2E Testing Application

This example provides a predictable configuration for E2E tests.
It includes various field types with known values for reliable testing.
"""

import argparse
import pathlib
import sys
from datetime import date
from typing import Annotated, Literal

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, NegativeInt, PositiveInt

sys.path.insert(0, str(__file__).replace("\\", "/").rsplit("/", 3)[0])

from pydantic_ui import (
    ActionButton,
    DisplayConfig,
    FieldConfig,
    Renderer,
    UIConfig,
    ViewDisplay,
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


class PanelMetadata(BaseModel):
    """Metadata used to verify configurable tree/detail display text."""

    tree_title: str = Field(default="Configuration Tree", description="Tree panel title")
    tree_description: str = Field(
        default="Browse and select fields to edit", description="Tree panel description"
    )
    main_title: str = Field(default="Main Editor", description="Main panel title")
    main_description: str = Field(
        default="Edit details for the selected node", description="Main panel description"
    )


class DiskStorage(BaseModel):
    """Discriminated union variant for local disk storage."""

    backend_type: Literal["disk"] = "disk"
    root_path: str = Field(default="/var/lib/e2e", description="Filesystem root path")
    encrypted: bool = Field(default=True, description="Enable encryption at rest")


class S3Storage(BaseModel):
    """Discriminated union variant for S3 storage."""

    backend_type: Literal["s3"] = "s3"
    bucket: str = Field(default="e2e-config-bucket", description="S3 bucket name")
    region: str = Field(default="us-east-1", description="AWS region")
    use_ssl: bool = Field(default=True, description="Use HTTPS transport")


class MemoryStorage(BaseModel):
    """Discriminated union variant for in-memory storage."""

    backend_type: Literal["memory"] = "memory"
    max_items: int = Field(default=1024, ge=1, description="Maximum in-memory items")
    persistent_snapshot: bool = Field(
        default=False, description="Persist snapshots to disk on shutdown"
    )


class AggressiveBudget:
    """Marker metadata for aggressive retry budget alias labels."""

    def __repr__(self) -> str:
        return "AggressiveBudget()"


class ConservativeBudget:
    """Marker metadata for conservative retry budget alias labels."""

    def __repr__(self) -> str:
        return "ConservativeBudget()"


AggressiveRetryBudget = Annotated[
    int,
    AggressiveBudget(),
    Field(gt=0, le=3, description="Aggressive retry budget range"),
]
ConservativeRetryBudget = Annotated[
    int,
    ConservativeBudget(),
    Field(gt=3, le=10, description="Conservative retry budget range"),
]


class ServiceContact(BaseModel):
    """Nested contact details for deep table rows."""

    team: str = Field(default="platform", description="Owning team")
    manager: str = Field(default="Alex Kim", description="Manager name")
    email: str = Field(default="alex.kim@example.com", description="Contact email")


class ServiceWindow(BaseModel):
    """Maintenance window details for deep table rows."""

    start_hour: int = Field(default=1, ge=0, le=23, description="Window start hour")
    end_hour: int = Field(default=3, ge=0, le=23, description="Window end hour")


class ServiceLocation(BaseModel):
    """Infrastructure location metadata."""

    region: str = Field(default="us-east-1", description="Cloud region")
    zone: str = Field(default="use1-az2", description="Availability zone")
    rack: str = Field(default="rack-12", description="Rack identifier")


class ServiceDeployment(BaseModel):
    """Deployment metadata with nested object depth for table view tests."""

    revision: int = Field(default=17, description="Deployment revision")
    contact: ServiceContact = Field(default_factory=ServiceContact, description="Service contact")
    window: ServiceWindow = Field(default_factory=ServiceWindow, description="Maintenance window")
    location: ServiceLocation = Field(default_factory=ServiceLocation, description="Location")


class ServiceMetrics(BaseModel):
    """Performance metrics used by deep table rows."""

    cpu: float = Field(default=61.5, ge=0, le=100, description="CPU utilization %")
    memory: float = Field(default=72.3, ge=0, le=100, description="Memory utilization %")
    latency_ms: float = Field(default=18.2, ge=0, description="Latency in milliseconds")
    error_rate: float = Field(default=0.02, ge=0, le=1, description="Error rate (0-1)")


class DeepGridRow(BaseModel):
    """Deeply nested row model for table view E2E tests."""

    service: str = Field(default="ingest", description="Service name")
    enabled: bool = Field(default=True, description="Service enabled")
    deployment: ServiceDeployment = Field(
        default_factory=ServiceDeployment,
        description="Deployment details",
    )
    metrics: ServiceMetrics = Field(default_factory=ServiceMetrics, description="Service metrics")


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
    server_timeout: PositiveInt | NegativeInt = Field(
        default=30,
        description="Server timeout in seconds; set < 0 to disable timeout",
    )
    request_rate_limit: Annotated[
        int,
        Field(ge=1, le=5000, default=1200, description="Maximum requests per minute"),
        FieldConfig(
            renderer=Renderer.SLIDER,
            props={"min": 1, "max": 5000, "step": 50},
        ),
    ]
    retry_budget: AggressiveRetryBudget | ConservativeRetryBudget = Field(
        default=4,
        description="Alias-backed annotated union for retry budget profile",
    )

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

    # Discriminated union rendered with card selection UI
    storage_backend: Annotated[
        DiskStorage | S3Storage | MemoryStorage,
        Field(
            discriminator="backend_type",
            description="Storage backend configuration (discriminated union)",
        ),
    ] = Field(default_factory=DiskStorage)

    # Panel metadata object with explicit tree/detail display overrides
    panel_metadata: PanelMetadata = Field(
        default_factory=PanelMetadata,
        description="Configurable tree/detail labels for E2E tests",
    )

    # Array fields
    tags: list[str] = Field(default=["test", "e2e", "example"], description="Application tags")
    users: list[Person] = Field(
        default_factory=lambda: [
            Person(name="Alice Smith", age=25, email="alice@example.com"),
            Person(name="Bob Jones", age=35, email="bob@example.com"),
        ],
        description="List of users",
    )
    archived_users: list[Person] = Field(
        default_factory=lambda: [
            Person(name="Archived User", age=41, email="archived@example.com"),
        ],
        description="Archive list used for tree copy/paste tests",
    )
    deep_grid_rows: list[DeepGridRow] = Field(
        default_factory=lambda: [
            DeepGridRow(
                service="ingest",
                enabled=True,
                deployment=ServiceDeployment(
                    revision=17,
                    contact=ServiceContact(
                        team="platform",
                        manager="Alex Kim",
                        email="alex.kim@example.com",
                    ),
                    window=ServiceWindow(start_hour=1, end_hour=3),
                    location=ServiceLocation(region="us-east-1", zone="use1-az2", rack="rack-12"),
                ),
                metrics=ServiceMetrics(cpu=61.5, memory=72.3, latency_ms=18.2, error_rate=0.02),
            ),
            DeepGridRow(
                service="worker",
                enabled=False,
                deployment=ServiceDeployment(
                    revision=21,
                    contact=ServiceContact(
                        team="compute",
                        manager="Priya Nair",
                        email="priya.nair@example.com",
                    ),
                    window=ServiceWindow(start_hour=2, end_hour=5),
                    location=ServiceLocation(region="eu-west-1", zone="euw1-az1", rack="rack-7"),
                ),
                metrics=ServiceMetrics(cpu=47.8, memory=58.1, latency_ms=24.6, error_rate=0.01),
            ),
        ],
        description="Deeply nested rows used to exercise table view flattening",
    )
    maintenance_start_hours: list[Annotated[int, Field(ge=0, le=23)]] = Field(
        default_factory=lambda: [1, 13, 22],
        description="Maintenance start hours in 24-hour format (0-23)",
    )

    # Optional fields
    optional_owner: Person | None = Field(
        default_factory=lambda: Person(
            name="Optional Owner",
            age=29,
            email="optional.owner@example.com",
        ),
        description="An optional nested owner object used for disable/enable card tests",
    )
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
    subtitle="Configuration UI for E2E testing",
    collapsible_tree=True,
    show_validation=True,
    show_save_reset=True,
    table_pinned_columns=["__check", "__row_number", "email"],
    # Logo URLs for testing theme-aware logos
    logo_url="/static/lightlogo.png",
    logo_url_dark="/static/darklogo.png",
    favicon_url="/static/lightlogo.png",
    class_configs={
        "DiskStorage": FieldConfig(
            display=DisplayConfig(
                card=ViewDisplay(
                    title="Disk Storage",
                    subtitle="Local filesystem backend",
                    help_text="Stores data on local disk",
                )
            )
        ),
        "S3Storage": FieldConfig(
            display=DisplayConfig(
                card=ViewDisplay(
                    title="S3 Storage",
                    subtitle="Object storage backend",
                    help_text="Stores data in an S3 bucket",
                )
            )
        ),
        "MemoryStorage": FieldConfig(
            display=DisplayConfig(
                card=ViewDisplay(
                    title="Memory Storage",
                    subtitle="Ephemeral in-memory backend",
                    help_text="Fast, non-persistent storage",
                )
            )
        ),
    },
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
        "server_timeout": FieldConfig(
            display=DisplayConfig(
                title="Server Timeout Policy",
                subtitle="Choose positive timeout or disabled timeout mode",
                help_text="This title verifies DisplayConfig overrides for union fields",
            )
        ),
        "server_timeout.PositiveInt": FieldConfig(
            display=DisplayConfig(
                title="Server Timeout (Enabled)",
            )
        ),
        "request_rate_limit": FieldConfig(
            display=DisplayConfig(
                title="Request Rate Limit",
                subtitle="Requests allowed per minute",
                help_text="Annotated integer with Field constraints and slider renderer",
            )
        ),
        "retry_budget": FieldConfig(
            display=DisplayConfig(
                title="Retry Budget Profile",
                subtitle="Alias-backed annotated union labels",
                help_text="Switch between aggressive and conservative retry budgets",
            )
        ),
        "maintenance_start_hours": FieldConfig(
            display=DisplayConfig(
                title="Maintenance Start Hours",
                subtitle="Hours in 24-hour format",
                help_text="Annotated list item constraints (0-23)",
            )
        ),
        "owner": FieldConfig(
            display=DisplayConfig(
                title="Owner - {name}",
                subtitle="Application owner information",
            ),
        ),
        "optional_owner": FieldConfig(
            display=DisplayConfig(
                title="Optional Owner - {name}",
                subtitle="Optional nested owner card used in E2E disable confirmation tests",
            ),
        ),
        "storage_backend": FieldConfig(
            renderer=Renderer.UNION_TABS,
            display=DisplayConfig(
                title="Storage Backend",
                subtitle="Discriminated union rendered as selectable cards",
                help_text="Select one backend card and edit its fields",
                tree=ViewDisplay(
                    title="Storage Backend",
                    subtitle="Union card selector",
                ),
                detail=ViewDisplay(
                    title="Storage Backend",
                    subtitle="Main panel union card editor",
                ),
            ),
        ),
        "panel_metadata": FieldConfig(
            display=DisplayConfig(
                title="Panel Metadata",
                subtitle="Default panel metadata display",
                tree=ViewDisplay(
                    title="Tree Labels",
                    subtitle="Shown in tree navigation",
                ),
                detail=ViewDisplay(
                    title="Main Panel Labels",
                    subtitle="Shown in detail panel header",
                    help_text="Used for configurable title/subtitle E2E assertions",
                ),
            )
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
        "archived_users": FieldConfig(
            display=DisplayConfig(
                title="Archived Users",
                subtitle="Secondary list for copy/paste tests",
            ),
        ),
        "archived_users.[]": FieldConfig(
            display=DisplayConfig(
                title="{name}",
                subtitle="{email}",
            ),
        ),
        "deep_grid_rows": FieldConfig(
            display=DisplayConfig(
                title="Deep Grid Rows",
                subtitle="Nested rows for table flattening tests",
                table=ViewDisplay(
                    title="Deep Grid Rows Table",
                    subtitle="Nested service rows",
                    pinned_columns=["__check", "__row_number", "service"],
                ),
            )
        ),
        "deep_grid_rows.[]": FieldConfig(
            display=DisplayConfig(
                title="{service}",
                subtitle="rev {deployment.revision} | {deployment.contact.email}",
            )
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
app.mount("/static", StaticFiles(directory=pathlib.Path(__file__).parent / "static"), name="static")


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

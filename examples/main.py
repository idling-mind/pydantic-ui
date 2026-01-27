"""
Example: Basic usage of pydantic-ui

This example shows how to create a simple data editing UI for a configuration model.
"""

import sys
from typing import Annotated, Literal

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel, Field

sys.path.insert(0, str(__file__).replace("\\", "/").rsplit("/", 3)[0])

# Import pydantic_ui components
from pydantic_ui import (
    DisplayConfig,
    FieldConfig,
    Renderer,
    UIConfig,
    ViewDisplay,
    create_pydantic_ui,
)


# Define your Pydantic models
class DatabaseConfig(BaseModel):
    """Database connection settings"""

    host: str = Field(default="localhost", description="Database server hostname")
    port: Annotated[
        int,
        Field(ge=1, le=65535, default=5432, description="Database server port"),
        FieldConfig(renderer=Renderer.NUMBER_INPUT),
    ]
    database: str = Field(default="mydb", description="Database name")
    username: str = Field(default="admin", description="Database username")
    password: str = Field(default="", description="Database password")
    ssl_enabled: Annotated[
        bool,
        Field(default=False, description="Enable SSL connection"),
        FieldConfig(renderer=Renderer.TOGGLE),
    ]
    pool_size: Annotated[
        int,
        Field(ge=1, le=100, default=10, description="Connection pool size"),
        FieldConfig(renderer=Renderer.SLIDER, props={"min": 1, "max": 100, "step": 1}),
    ]


class LoggingConfig(BaseModel):
    """Logging configuration"""

    level: Annotated[
        Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        Field(default="INFO", description="Logging level"),
        FieldConfig(renderer=Renderer.SELECT),
    ]
    format: Annotated[
        str,
        Field(
            default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            description="Log message format",
        ),
        FieldConfig(renderer=Renderer.TEXT_AREA, props={"rows": 2}),
    ]
    file_path: str | None = Field(
        default=None, description="Path to log file (optional, logs to console if not set)"
    )
    max_file_size: Annotated[
        int,
        Field(ge=1, le=1000, default=10, description="Max log file size in MB"),
        FieldConfig(renderer=Renderer.SLIDER, props={"min": 1, "max": 1000}),
    ]
    backup_count: Annotated[
        int,
        Field(ge=0, le=10, default=5, description="Number of backup files to keep"),
        FieldConfig(renderer=Renderer.NUMBER_INPUT),
    ]


class ServerConfig(BaseModel):
    """Server settings"""

    name: str = Field(default="MyApp", description="Application name")
    version: str = Field(default="1.0.0", description="Application version")
    debug: Annotated[
        bool,
        Field(default=False, description="Enable debug mode"),
        FieldConfig(renderer=Renderer.TOGGLE),
    ]
    workers: Annotated[
        int,
        Field(ge=1, le=32, default=4, description="Number of worker processes"),
        FieldConfig(renderer=Renderer.SLIDER, props={"min": 1, "max": 32}),
    ]
    allowed_hosts: list[str] = Field(
        default=["localhost", "127.0.0.1"], description="List of allowed hostnames"
    )


class NotificationConfig(BaseModel):
    """Notification settings"""

    email_enabled: bool = Field(default=True, description="Enable email notifications")
    smtp_host: str | None = Field(default=None, description="SMTP server hostname")
    smtp_port: int = Field(default=587, ge=1, le=65535, description="SMTP port")
    slack_enabled: bool = Field(default=False, description="Enable Slack notifications")
    slack_webhook: str | None = Field(default=None, description="Slack webhook URL")


class FeatureFlags(BaseModel):
    """Feature flag"""

    flag: str
    enabled: bool


class AppConfig(BaseModel):
    """
    Application Configuration

    This is the main configuration model for the application.
    It contains all the settings needed to run the app.
    """

    server: ServerConfig = Field(default_factory=ServerConfig, description="Server settings")
    description: Annotated[str, FieldConfig(renderer=Renderer.MARKDOWN)] = Field(
        default="## Welcome to the App Configuration Editor\n\nUse this UI to edit your application settings.",
        description="Application description (supports Markdown)",
    )
    database: DatabaseConfig = Field(
        default_factory=DatabaseConfig, description="Database settings"
    )
    logging: LoggingConfig = Field(default_factory=LoggingConfig, description="Logging settings")
    notifications: NotificationConfig = Field(
        default_factory=NotificationConfig, description="Notification settings"
    )
    feature_flags: list[FeatureFlags] = Field(
        default_factory=list,
        description="Feature flags",
    )
    metadata: Annotated[
        dict, Field(default={}, description="Additional metadata"), FieldConfig(renderer="json")
    ]


# Create FastAPI app
app = FastAPI(title="Pydantic UI Example")

# Configure UI
ui_config = UIConfig(
    title="App Configuration Editor",
    description="Edit your application configuration",
    collapsible_tree=True,
    show_validation=True,
    attr_configs={
        "server": FieldConfig(
            display=DisplayConfig(
                title="Server - {name}",
            ),
        ),
        "feature_flags.[]": FieldConfig(
            display=DisplayConfig(
                title="Feature Flag - {flag}",
            ),
        ),
        "server.name": FieldConfig(
            placeholder="Enter your app name",
            display=DisplayConfig(
                title="Application Name",
            ),
        ),
        "database.password": FieldConfig(
            renderer=Renderer.PASSWORD,
            display=DisplayConfig(
                title="Database Password",
            ),
        ),
        "server.allowed_hosts.[]": FieldConfig(
            placeholder="Add allowed host",
            display=DisplayConfig(
                subtitle="Address of the allowed host",
                detail=ViewDisplay(title="Host address"),
            ),
        ),
    },
)

# Create and mount the pydantic-ui router
pydantic_ui_router = create_pydantic_ui(
    model=AppConfig,
    ui_config=ui_config,
    prefix="/config",
)

app.include_router(pydantic_ui_router)


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

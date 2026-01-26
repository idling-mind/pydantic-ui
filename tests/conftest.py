from __future__ import annotations

import asyncio
from datetime import date, datetime
from enum import Enum
from typing import Annotated, Any, Literal

# StrEnum is available in Python 3.11+, define it for older versions
try:
    from enum import StrEnum
except ImportError:

    class StrEnum(str, Enum):
        pass


import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel, Field

from pydantic_ui import (
    ActionButton,
    DisplayConfig,
    FieldConfig,
    Renderer,
    UIConfig,
    create_pydantic_ui,
)
from pydantic_ui.handlers import DataHandler
from pydantic_ui.sessions import Session, SessionManager

# =============================================================================
# Test Models
# =============================================================================


class Priority(StrEnum):
    """Priority levels for tasks."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Status(Enum):
    """Status values."""

    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class Address(BaseModel):
    """A simple address model."""

    street: str = Field(description="Street address")
    city: str = Field(description="City name")
    zip_code: str = Field(max_length=10)
    country: str = "USA"


class Person(BaseModel):
    """A person with basic information."""

    name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=0, le=150)
    email: str | None = None
    active: bool = True


class PersonWithAddress(BaseModel):
    """A person with an address."""

    name: str
    age: int = 25
    address: Address


class Task(BaseModel):
    """A task with priority."""

    title: str
    description: str | None = None
    priority: Priority = Priority.MEDIUM
    status: Status = Status.DRAFT
    due_date: date | None = None
    completed: bool = False


class Project(BaseModel):
    """A project containing tasks and team members."""

    name: str
    description: str | None = None
    tasks: list[Task] = Field(default_factory=list)
    team: list[Person] = Field(default_factory=list)
    tags: set[str] = Field(default_factory=set)


class Config(BaseModel):
    """A configuration model with various types."""

    app_name: str = "My App"
    debug: bool = False
    max_connections: int = Field(default=100, ge=1, le=1000)
    timeout: float = 30.0
    features: list[str] = Field(default_factory=list)
    settings: dict[str, Any] = Field(default_factory=dict)


class LiteralModel(BaseModel):
    """Model with Literal types."""

    color: Literal["red", "green", "blue"] = "blue"
    size: Literal["small", "medium", "large"]


class AnnotatedModel(BaseModel):
    """Model with Annotated field configurations."""

    name: str
    age: Annotated[
        int,
        FieldConfig(
            renderer=Renderer.SLIDER,
            display=DisplayConfig(help_text="Your age"),
            props={"min": 0, "max": 120},
        ),
    ] = 30
    bio: Annotated[
        str,
        FieldConfig(
            renderer=Renderer.TEXT_AREA,
            placeholder="Tell us about yourself",
        ),
    ] = ""


class DeepNestedModel(BaseModel):
    """Model with deep nesting."""

    level1: dict[str, dict[str, list[str]]] = Field(default_factory=dict)


class DateTimeModel(BaseModel):
    """Model with datetime fields."""

    created_at: datetime
    updated_at: datetime | None = None
    birth_date: date | None = None


class SimpleModel(BaseModel):
    """The simplest model for basic tests."""

    name: str
    value: int = 0


# =============================================================================
# Fixtures - Models
# =============================================================================


@pytest.fixture
def simple_model() -> type[SimpleModel]:
    """Return SimpleModel class."""
    return SimpleModel


@pytest.fixture
def person_model() -> type[Person]:
    """Return Person model class."""
    return Person


@pytest.fixture
def person_with_address_model() -> type[PersonWithAddress]:
    """Return PersonWithAddress model class."""
    return PersonWithAddress


@pytest.fixture
def task_model() -> type[Task]:
    """Return Task model class."""
    return Task


@pytest.fixture
def project_model() -> type[Project]:
    """Return Project model class."""
    return Project


@pytest.fixture
def config_model() -> type[Config]:
    """Return Config model class."""
    return Config


@pytest.fixture
def literal_model() -> type[LiteralModel]:
    """Return LiteralModel class."""
    return LiteralModel


@pytest.fixture
def annotated_model() -> type[AnnotatedModel]:
    """Return AnnotatedModel class."""
    return AnnotatedModel


@pytest.fixture
def datetime_model() -> type[DateTimeModel]:
    """Return DateTimeModel class."""
    return DateTimeModel


# =============================================================================
# Fixtures - Instances
# =============================================================================


@pytest.fixture
def simple_instance() -> SimpleModel:
    """Return a simple model instance."""
    return SimpleModel(name="test", value=42)


@pytest.fixture
def person_instance() -> Person:
    """Return a person instance."""
    return Person(name="John Doe", age=30, email="john@example.com")


@pytest.fixture
def address_instance() -> Address:
    """Return an address instance."""
    return Address(street="123 Main St", city="Springfield", zip_code="12345")


@pytest.fixture
def task_instance() -> Task:
    """Return a task instance."""
    return Task(
        title="Test Task",
        description="A test task",
        priority=Priority.HIGH,
        due_date=date(2024, 12, 31),
    )


@pytest.fixture
def project_instance() -> Project:
    """Return a project instance with tasks and team members."""
    return Project(
        name="Test Project",
        description="A test project",
        tasks=[
            Task(title="Task 1", priority=Priority.HIGH),
            Task(title="Task 2", priority=Priority.LOW),
        ],
        team=[
            Person(name="Alice", age=28),
            Person(name="Bob", age=35),
        ],
        tags={"python", "testing"},
    )


# =============================================================================
# Fixtures - Configuration
# =============================================================================


@pytest.fixture
def default_ui_config() -> UIConfig:
    """Return default UI configuration."""
    return UIConfig()


@pytest.fixture
def custom_ui_config() -> UIConfig:
    """Return custom UI configuration."""
    return UIConfig(
        title="Custom Editor",
        subtitle="A custom editor",
        theme="dark",
        show_validation=True,
        auto_save=True,
        auto_save_delay=500,
        actions=[
            ActionButton(id="validate", label="Validate", variant="secondary"),
            ActionButton(id="export", label="Export", variant="outline"),
        ],
        show_save_reset=True,
        attr_configs={
            "name": FieldConfig(
                display=DisplayConfig(title="Full Name", help_text="Your legal name"),
                placeholder="Enter your name",
            ),
            "age": FieldConfig(
                renderer=Renderer.SLIDER,
                props={"min": 0, "max": 120, "step": 1},
            ),
            # Wildcard pattern for array items
            "tasks.[].title": FieldConfig(
                display=DisplayConfig(title="Task Title"),
                placeholder="What needs to be done?",
            ),
        },
    )


# =============================================================================
# Fixtures - Sessions
# =============================================================================


@pytest.fixture
def session_manager() -> SessionManager:
    """Return a session manager."""
    return SessionManager(session_timeout=3600)


@pytest.fixture
async def session(session_manager: SessionManager) -> Session:
    """Return a session."""
    session, _ = await session_manager.get_or_create_session(None, {"name": "test", "value": 0})
    return session


# =============================================================================
# Fixtures - Handlers
# =============================================================================


@pytest.fixture
def data_handler(simple_model: type[SimpleModel]) -> DataHandler:
    """Return a data handler for SimpleModel."""
    return DataHandler(
        model=simple_model,
        ui_config=UIConfig(),
    )


@pytest.fixture
def data_handler_with_config(
    person_model: type[Person],
    custom_ui_config: UIConfig,
) -> DataHandler:
    """Return a data handler with custom configuration."""
    return DataHandler(
        model=person_model,
        ui_config=custom_ui_config,
    )


# =============================================================================
# Fixtures - FastAPI App & Client
# =============================================================================


@pytest.fixture
def app_simple(simple_model: type[SimpleModel]) -> FastAPI:
    """Return a FastAPI app with simple model router."""
    app = FastAPI()
    router = create_pydantic_ui(simple_model, prefix="/editor")
    app.include_router(router)
    return app


@pytest.fixture
def app_with_config(
    person_model: type[Person],
    custom_ui_config: UIConfig,
) -> FastAPI:
    """Return a FastAPI app with custom configuration."""
    app = FastAPI()
    router = create_pydantic_ui(
        person_model,
        ui_config=custom_ui_config,
        prefix="/editor",
    )
    app.include_router(router)
    return app


@pytest.fixture
def app_with_loader_saver(simple_model: type[SimpleModel]) -> FastAPI:
    """Return a FastAPI app with data loader and saver."""
    saved_data: list[SimpleModel] = []

    def load_data() -> SimpleModel:
        if saved_data:
            return saved_data[-1]
        return SimpleModel(name="loaded", value=100)

    def save_data(instance: SimpleModel) -> None:
        saved_data.append(instance)

    app = FastAPI()
    router = create_pydantic_ui(
        simple_model,
        data_loader=load_data,
        data_saver=save_data,
        prefix="/editor",
    )
    app.include_router(router)
    app.state.saved_data = saved_data  # Store for test access
    return app


@pytest.fixture
async def client_simple(app_simple: FastAPI) -> AsyncClient:
    """Return an async client for simple app."""
    transport = ASGITransport(app=app_simple)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def client_with_config(app_with_config: FastAPI) -> AsyncClient:
    """Return an async client for configured app."""
    transport = ASGITransport(app=app_with_config)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def client_with_loader(app_with_loader_saver: FastAPI) -> AsyncClient:
    """Return an async client for app with loader/saver."""
    transport = ASGITransport(app=app_with_loader_saver)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


# =============================================================================
# Fixtures - Event Loop
# =============================================================================


@pytest.fixture(scope="session")
def event_loop_policy():
    """Use default event loop policy."""
    return asyncio.DefaultEventLoopPolicy()

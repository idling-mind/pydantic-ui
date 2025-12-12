"""Internal Pydantic models for API requests/responses."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class ActionButtonResponse(BaseModel):
    """Action button configuration for API response."""

    id: str
    label: str
    variant: Literal["default", "secondary", "outline", "ghost", "destructive"] = "default"
    icon: str | None = None
    disabled: bool = False
    tooltip: str | None = None
    confirm: str | None = None
    upload_file: bool = False


class SchemaField(BaseModel):
    """Schema for a single field."""

    type: str
    title: str | None = None
    description: str | None = None
    required: bool = True
    default: Any = None
    constraints: dict[str, Any] = Field(default_factory=dict)
    ui_config: dict[str, Any] | None = None
    fields: dict[str, "SchemaField"] | None = None
    items: "SchemaField | None" = None


class SchemaResponse(BaseModel):
    """Response schema for the /api/schema endpoint."""

    name: str
    type: str = "object"
    description: str | None = None
    fields: dict[str, SchemaField]


class DataResponse(BaseModel):
    """Response for the /api/data endpoint."""

    data: dict[str, Any]


class DataUpdateRequest(BaseModel):
    """Request body for updating data."""

    data: dict[str, Any]


class PartialUpdateRequest(BaseModel):
    """Request body for partial data updates."""

    path: str
    value: Any


class ValidationRequest(BaseModel):
    """Request body for validation."""

    data: dict[str, Any]


class ValidationError(BaseModel):
    """A single validation error."""

    path: str
    message: str
    type: str


class ValidationResponse(BaseModel):
    """Response for the /api/validate endpoint."""

    valid: bool
    errors: list[ValidationError] = Field(default_factory=list)


class ConfigResponse(BaseModel):
    """Response for the /api/config endpoint."""

    title: str
    description: str
    theme: str
    read_only: bool
    show_validation: bool
    auto_save: bool
    auto_save_delay: int
    collapsible_tree: bool
    show_types: bool
    actions: list[ActionButtonResponse] = Field(default_factory=list)
    show_save_reset: bool = False


# Update forward references
SchemaField.model_rebuild()

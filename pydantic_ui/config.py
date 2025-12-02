"""Configuration classes for Pydantic UI."""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class Renderer(str, Enum):
    """Available field renderers."""

    AUTO = "auto"
    TEXT_INPUT = "text_input"
    TEXT_AREA = "text_area"
    NUMBER_INPUT = "number_input"
    SLIDER = "slider"
    CHECKBOX = "checkbox"
    TOGGLE = "toggle"
    SELECT = "select"
    MULTI_SELECT = "multi_select"
    DATE_PICKER = "date_picker"
    DATETIME_PICKER = "datetime_picker"
    COLOR_PICKER = "color_picker"
    FILE_UPLOAD = "file_upload"
    PASSWORD = "password"
    EMAIL = "email"
    URL = "url"


class FieldConfig(BaseModel):
    """Per-field UI configuration.

    Use with Annotated types to customize how fields are rendered:

        from typing import Annotated
        from pydantic_ui import FieldConfig, Renderer

        class MyModel(BaseModel):
            age: Annotated[int, FieldConfig(
                renderer=Renderer.SLIDER,
                props={"min": 0, "max": 120}
            )]
    """

    renderer: Renderer | str = Field(
        default=Renderer.AUTO,
        description="The renderer to use for this field",
    )
    label: str | None = Field(
        default=None,
        description="Custom label (defaults to field name)",
    )
    placeholder: str | None = Field(
        default=None,
        description="Placeholder text for input fields",
    )
    help_text: str | None = Field(
        default=None,
        description="Help text shown below the field",
    )
    hidden: bool = Field(
        default=False,
        description="Hide this field from the UI",
    )
    read_only: bool = Field(
        default=False,
        description="Make this field read-only",
    )
    props: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional props passed to the renderer",
    )

    class Config:
        use_enum_values = True


class UIConfig(BaseModel):
    """Global UI configuration."""

    title: str = Field(
        default="Data Editor",
        description="Title shown in the header",
    )
    description: str = Field(
        default="",
        description="Description shown below the title",
    )
    theme: str = Field(
        default="system",
        description="Theme: 'light', 'dark', or 'system'",
    )
    read_only: bool = Field(
        default=False,
        description="Make the entire form read-only",
    )
    show_validation: bool = Field(
        default=True,
        description="Show validation errors",
    )
    auto_save: bool = Field(
        default=False,
        description="Automatically save changes",
    )
    auto_save_delay: int = Field(
        default=1000,
        description="Delay in ms before auto-saving",
    )
    collapsible_tree: bool = Field(
        default=True,
        description="Allow tree nodes to be collapsed",
    )
    show_types: bool = Field(
        default=True,
        description="Show type badges in the tree",
    )

"""Configuration classes for Pydantic UI."""

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class ActionButton(BaseModel):
    """Configuration for a custom action button.

    Action buttons appear in the header and trigger Python callbacks
    when clicked.

    Example:
        ActionButton(
            id="validate",
            label="Validate All",
            variant="secondary",
            icon="check-circle",
            tooltip="Run custom validation"
        )
    """

    id: str = Field(description="Unique identifier for the action")
    label: str = Field(description="Button label text")
    variant: Literal["default", "secondary", "outline", "ghost", "destructive"] = Field(
        default="default", description="Button style variant"
    )
    icon: str | None = Field(
        default=None, description="Lucide icon name (e.g., 'check', 'trash', 'play')"
    )
    disabled: bool = Field(default=False, description="Whether the button is disabled")
    tooltip: str | None = Field(default=None, description="Tooltip text on hover")
    confirm: str | None = Field(
        default=None,
        description="If set, show confirmation dialog with this message before triggering",
    )


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
        alias="description",
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
        allow_population_by_field_name = True


class UIConfig(BaseModel):
    """Global UI configuration."""

    title: str = Field(
        default="Data Editor",
        description="Title shown in the header and as default for root panel",
    )
    description: str = Field(
        default="",
        description="Description shown below the title",
    )
    logo_text: str | None = Field(
        default=None,
        description="Short text for the logo (e.g., 'P', 'UI'). If not set, uses first letter of title",
    )
    logo_url: str | None = Field(
        default=None,
        description="URL to a logo image. If set, overrides logo_text",
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
    actions: list[ActionButton] = Field(
        default_factory=list,
        description="Custom action buttons shown in the header",
    )
    show_save_reset: bool = Field(
        default=False,
        description="Show Save and Reset buttons in the footer",
    )
    responsive_columns: dict[int, int] = Field(
        default_factory=lambda: {640: 1, 1000: 2, 1600: 3},
        description="Responsive column breakpoints. Keys are max-width in pixels, values are number of columns. E.g., {640: 1, 1000: 2, 1600: 3} means 1 column up to 640px, 2 columns from 640-1000px, 3 columns above 1000px.",
    )

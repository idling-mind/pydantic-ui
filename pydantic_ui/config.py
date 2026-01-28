"""Configuration classes for Pydantic UI."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


@dataclass
class ViewDisplay:
    """Per-view display overrides.

    All fields are optional - unset fields fall back to the parent DisplayConfig values.

    Example:
        ViewDisplay(
            title="Port",  # Shorter title for tree view
        )
    """

    title: str | None = None
    subtitle: str | None = None
    help_text: str | None = None

    def model_dump(self) -> dict[str, Any]:
        """Return a dict representation."""
        return {
            "title": self.title,
            "subtitle": self.subtitle,
            "help_text": self.help_text,
        }


@dataclass
class DisplayConfig:
    """Unified display configuration for a field or object.

    Defines how title, subtitle, help text, and icon are displayed across all views.
    Per-view overrides allow customizing display for specific contexts (tree, detail, table, card).

    Title and subtitle support template syntax with curly braces to reference data fields:
    - "{name}" → value of data.name
    - "{address.city}" → value of data.address.city
    - "{name} ({role})" → combines multiple fields with static text

    Example:
        DisplayConfig(
            title="Server Configuration",
            subtitle="Primary application server",
            help_text="Configure the main server settings here.",
            tree=ViewDisplay(title="Server"),  # Shorter in tree view
        )

    For array items, use templates to derive display from item data:
        DisplayConfig(
            title="{name}",
            subtitle="{role} - {department}",
        )
    """

    title: str | None = None
    subtitle: str | None = None
    help_text: str | None = None

    # Per-view overrides
    tree: ViewDisplay | None = None
    detail: ViewDisplay | None = None
    table: ViewDisplay | None = None
    card: ViewDisplay | None = None

    def model_dump(self) -> dict[str, Any]:
        """Return a dict representation."""
        return {
            "title": self.title,
            "subtitle": self.subtitle,
            "help_text": self.help_text,
            "tree": self.tree.model_dump() if self.tree else None,
            "detail": self.detail.model_dump() if self.detail else None,
            "table": self.table.model_dump() if self.table else None,
            "card": self.card.model_dump() if self.card else None,
        }


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
    upload_file: bool = Field(
        default=False,
        description="If True, prompt for file upload before triggering action",
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
    RADIO_GROUP = "radio_group"
    CHECKLIST = "checklist"
    MARKDOWN = "markdown"
    SEGMENTED_CONTROL = "segmented_control"
    DATE_PICKER = "date_picker"
    DATETIME_PICKER = "datetime_picker"
    COLOR_PICKER = "color_picker"
    FILE_UPLOAD = "file_upload"
    FILE_SELECT = "file_select"
    PASSWORD = "password"
    EMAIL = "email"
    URL = "url"
    # Union renderers
    UNION_SELECT = "union_select"  # Dropdown to select variant
    UNION_TABS = "union_tabs"  # Tabs/segmented control for variants


@dataclass
class FieldConfig:
    """Per-field UI configuration.

    Use with Annotated types to customize how fields are rendered:

        from typing import Annotated
        from pydantic_ui import FieldConfig, Renderer, DisplayConfig

        class MyModel(BaseModel):
            age: Annotated[int, FieldConfig(
                renderer=Renderer.SLIDER,
                display=DisplayConfig(
                    title="User Age",
                    subtitle="Age in years",
                    help_text="Enter age between 0 and 120",
                ),
                props={"min": 0, "max": 120}
            )]

    For array items, use template syntax to derive display from data:

        class MyModel(BaseModel):
            users: Annotated[list[User], FieldConfig(
                display=DisplayConfig(
                    title="{name}",
                    subtitle="{role} - {department}",
                )
            )]

    Use visible_when to conditionally show/hide fields based on JavaScript logic:

        class MyModel(BaseModel):
            created: datetime
            why_late: Annotated[str | None, FieldConfig(
                visible_when="new Date(data.created) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)"
            )] = None

    The visible_when string is evaluated as JavaScript. It has access to:
    - data: the full form data object
    - value: the current field's value
    """

    renderer: Renderer | str = Renderer.AUTO
    display: DisplayConfig | None = None
    placeholder: str | None = None
    hidden: bool = False
    read_only: bool = False
    visible_when: str | None = None
    options_from: str | None = None
    props: dict[str, Any] = field(default_factory=dict)

    def model_dump(self) -> dict[str, Any]:
        """Return a dict representation (for compatibility with Pydantic API)."""
        return {
            "renderer": self.renderer.value
            if isinstance(self.renderer, Renderer)
            else self.renderer,
            "display": self.display.model_dump() if self.display else None,
            "placeholder": self.placeholder,
            "hidden": self.hidden,
            "read_only": self.read_only,
            "visible_when": self.visible_when,
            "options_from": self.options_from,
            "props": self.props,
        }


class UIConfig(BaseModel):
    """Global UI configuration."""

    title: str = Field(
        default="Data Editor",
        description="Title shown in the header and as default for root panel",
    )
    subtitle: str = Field(
        default="",
        description="Subtitle shown below the title, overrides model docstring on main page",
    )
    logo_text: str | None = Field(
        default=None,
        description="Short text for the logo (e.g., 'P', 'UI'). If not set, uses first letter of title",
    )
    logo_url: str | None = Field(
        default=None,
        description="URL to a logo image for light mode. If set, overrides logo_text. "
        "Use with logo_url_dark for theme-aware logos.",
    )
    logo_url_dark: str | None = Field(
        default=None,
        description="URL to a logo image for dark mode. Falls back to logo_url if not set.",
    )
    favicon_url: str | None = Field(
        default=None,
        description="URL to a favicon image. Falls back to logo_url or default if not set.",
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
    class_configs: dict[str, FieldConfig] = Field(
        default_factory=dict,
        description="Configuration for specific Pydantic model classes, keyed by class name.",
    )
    attr_configs: dict[str, FieldConfig] = Field(
        default_factory=dict,
        description="Per-field UI configurations keyed by field path (e.g., 'user.name', 'items.[].title').",
    )

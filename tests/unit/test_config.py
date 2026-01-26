"""Tests for pydantic_ui/config.py - Configuration classes."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from pydantic_ui.config import ActionButton, DisplayConfig, FieldConfig, Renderer, UIConfig, ViewDisplay

# =============================================================================
# Tests for Renderer Enum
# =============================================================================


class TestRenderer:
    """Tests for Renderer enum."""

    def test_renderer_values(self):
        """Test all renderer values exist."""
        assert Renderer.AUTO.value == "auto"
        assert Renderer.TEXT_INPUT.value == "text_input"
        assert Renderer.TEXT_AREA.value == "text_area"
        assert Renderer.NUMBER_INPUT.value == "number_input"
        assert Renderer.SLIDER.value == "slider"
        assert Renderer.CHECKBOX.value == "checkbox"
        assert Renderer.TOGGLE.value == "toggle"
        assert Renderer.SELECT.value == "select"
        assert Renderer.MULTI_SELECT.value == "multi_select"
        assert Renderer.DATE_PICKER.value == "date_picker"
        assert Renderer.DATETIME_PICKER.value == "datetime_picker"
        assert Renderer.COLOR_PICKER.value == "color_picker"
        assert Renderer.FILE_UPLOAD.value == "file_upload"
        assert Renderer.PASSWORD.value == "password"
        assert Renderer.EMAIL.value == "email"
        assert Renderer.URL.value == "url"

    def test_renderer_is_string_enum(self):
        """Test Renderer inherits from str."""
        assert isinstance(Renderer.AUTO, str)
        assert Renderer.AUTO == "auto"


# =============================================================================
# Tests for FieldConfig
# =============================================================================


class TestFieldConfig:
    """Tests for FieldConfig class."""

    def test_defaults(self):
        """Test FieldConfig defaults."""
        config = FieldConfig()
        assert config.renderer == Renderer.AUTO
        assert config.display is None
        assert config.placeholder is None
        assert config.hidden is False
        assert config.read_only is False
        assert config.visible_when is None
        assert config.props == {}

    def test_all_options(self):
        """Test FieldConfig with all options set."""
        config = FieldConfig(
            renderer=Renderer.SLIDER,
            display=DisplayConfig(title="Custom Label", help_text="This is help text"),
            placeholder="Enter value",
            hidden=True,
            read_only=True,
            visible_when="data.status === 'active'",
            props={"min": 0, "max": 100, "step": 5},
        )
        assert config.renderer == Renderer.SLIDER
        assert config.display.title == "Custom Label"
        assert config.placeholder == "Enter value"
        assert config.display.help_text == "This is help text"
        assert config.hidden is True
        assert config.read_only is True
        assert config.visible_when == "data.status === 'active'"
        assert config.props == {"min": 0, "max": 100, "step": 5}

    def test_renderer_as_enum(self):
        """Test renderer accepts Renderer enum."""
        config = FieldConfig(renderer=Renderer.TEXT_AREA)
        assert config.renderer == Renderer.TEXT_AREA

    def test_renderer_as_string(self):
        """Test renderer accepts string value."""
        config = FieldConfig(renderer="custom_renderer")
        assert config.renderer == "custom_renderer"

    def test_serialization(self):
        """Test FieldConfig serialization."""
        config = FieldConfig(
            renderer=Renderer.SLIDER,
            display=DisplayConfig(title="Test"),
            visible_when="data.enabled === true",
            props={"min": 0},
        )
        data = config.model_dump()
        assert data["renderer"] == "slider"  # enum value
        assert data["display"]["title"] == "Test"
        assert data["visible_when"] == "data.enabled === true"
        assert data["props"] == {"min": 0}

    def test_visible_when_condition(self):
        """Test FieldConfig with various visible_when conditions."""
        # Simple condition
        config1 = FieldConfig(visible_when="data.status === 'active'")
        assert config1.visible_when == "data.status === 'active'"

        # Date-based condition
        config2 = FieldConfig(
            visible_when="new Date(data.created) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)"
        )
        assert "Date" in config2.visible_when

        # Value-based condition
        config3 = FieldConfig(visible_when="value !== null && value.length > 0")
        assert config3.visible_when == "value !== null && value.length > 0"


# =============================================================================
# Tests for ActionButton
# =============================================================================


class TestActionButton:
    """Tests for ActionButton class."""

    def test_defaults(self):
        """Test ActionButton defaults."""
        button = ActionButton(id="test", label="Test")
        assert button.id == "test"
        assert button.label == "Test"
        assert button.variant == "default"
        assert button.icon is None
        assert button.disabled is False
        assert button.tooltip is None
        assert button.confirm is None

    def test_all_options(self):
        """Test ActionButton with all options."""
        button = ActionButton(
            id="delete",
            label="Delete All",
            variant="destructive",
            icon="trash",
            disabled=True,
            tooltip="Delete all items",
            confirm="Are you sure?",
        )
        assert button.id == "delete"
        assert button.label == "Delete All"
        assert button.variant == "destructive"
        assert button.icon == "trash"
        assert button.disabled is True
        assert button.tooltip == "Delete all items"
        assert button.confirm == "Are you sure?"

    def test_variants(self):
        """Test all valid button variants."""
        variants = ["default", "secondary", "outline", "ghost", "destructive"]
        for variant in variants:
            button = ActionButton(id="test", label="Test", variant=variant)
            assert button.variant == variant

    def test_invalid_variant(self):
        """Test invalid variant raises error."""
        with pytest.raises(ValidationError):
            ActionButton(id="test", label="Test", variant="invalid")

    def test_serialization(self):
        """Test ActionButton serialization."""
        button = ActionButton(
            id="save",
            label="Save",
            variant="secondary",
            icon="check",
        )
        data = button.model_dump()
        assert data["id"] == "save"
        assert data["label"] == "Save"
        assert data["variant"] == "secondary"
        assert data["icon"] == "check"


# =============================================================================
# Tests for UIConfig
# =============================================================================


class TestUIConfig:
    """Tests for UIConfig class."""

    def test_defaults(self):
        """Test UIConfig defaults."""
        config = UIConfig()
        assert config.title == "Data Editor"
        assert config.description == ""
        assert config.logo_text is None
        assert config.logo_url is None
        assert config.theme == "system"
        assert config.read_only is False
        assert config.show_validation is True
        assert config.auto_save is False
        assert config.auto_save_delay == 1000
        assert config.collapsible_tree is True
        assert config.show_types is True
        assert config.actions == []
        assert config.show_save_reset is False
        assert config.footer_text == "Powered by Pydantic UI"
        assert config.footer_url == "https://github.com/idling-mind/pydantic-ui"

    def test_all_options(self):
        """Test UIConfig with all options."""
        actions = [
            ActionButton(id="validate", label="Validate"),
            ActionButton(id="export", label="Export"),
        ]
        config = UIConfig(
            title="Custom Editor",
            description="A custom configuration editor",
            logo_text="CE",
            logo_url="https://example.com/logo.png",
            theme="dark",
            read_only=True,
            show_validation=False,
            auto_save=True,
            auto_save_delay=500,
            collapsible_tree=False,
            show_types=False,
            actions=actions,
            show_save_reset=True,
            footer_text="Custom Footer",
            footer_url="https://example.com",
        )
        assert config.title == "Custom Editor"
        assert config.description == "A custom configuration editor"
        assert config.logo_text == "CE"
        assert config.logo_url == "https://example.com/logo.png"
        assert config.theme == "dark"
        assert config.read_only is True
        assert config.show_validation is False
        assert config.auto_save is True
        assert config.auto_save_delay == 500
        assert config.collapsible_tree is False
        assert config.show_types is False
        assert len(config.actions) == 2
        assert config.show_save_reset is True
        assert config.footer_text == "Custom Footer"
        assert config.footer_url == "https://example.com"

    def test_with_actions(self):
        """Test UIConfig with action buttons."""
        config = UIConfig(
            actions=[
                ActionButton(id="run", label="Run", variant="default", icon="play"),
                ActionButton(
                    id="delete",
                    label="Delete",
                    variant="destructive",
                    confirm="Are you sure?",
                ),
            ]
        )
        assert len(config.actions) == 2
        assert config.actions[0].id == "run"
        assert config.actions[0].icon == "play"
        assert config.actions[1].confirm == "Are you sure?"

    def test_serialization(self):
        """Test UIConfig serialization."""
        config = UIConfig(
            title="Test",
            theme="light",
            actions=[ActionButton(id="test", label="Test")],
        )
        data = config.model_dump()
        assert data["title"] == "Test"
        assert data["theme"] == "light"
        assert len(data["actions"]) == 1
        assert data["actions"][0]["id"] == "test"

    def test_theme_values(self):
        """Test valid theme values."""
        for theme in ["light", "dark", "system"]:
            config = UIConfig(theme=theme)
            assert config.theme == theme

"""Tests for DisplayConfig and ViewDisplay configuration classes."""

from dataclasses import asdict

from pydantic import BaseModel

from pydantic_ui.config import DisplayConfig, FieldConfig, ViewDisplay


class TestViewDisplay:
    """Tests for ViewDisplay dataclass."""

    def test_default_values(self):
        """ViewDisplay has all None defaults."""
        vd = ViewDisplay()
        assert vd.title is None
        assert vd.subtitle is None
        assert vd.help_text is None
        assert vd.icon is None

    def test_with_title(self):
        """ViewDisplay can be created with title."""
        vd = ViewDisplay(title="My Title")
        assert vd.title == "My Title"
        assert vd.subtitle is None

    def test_with_all_fields(self):
        """ViewDisplay can be created with all fields."""
        vd = ViewDisplay(
            title="Title",
            subtitle="Subtitle",
            help_text="Help",
        )
        assert vd.title == "Title"
        assert vd.subtitle == "Subtitle"
        assert vd.help_text == "Help"

    def test_asdict(self):
        """ViewDisplay can be converted to dict."""
        vd = ViewDisplay(title="Title", subtitle="Sub")
        d = asdict(vd)
        assert d == {
            "title": "Title",
            "subtitle": "Sub",
            "help_text": None,
            "icon": None,
        }


class TestDisplayConfig:
    """Tests for DisplayConfig dataclass."""

    def test_default_values(self):
        """DisplayConfig has all None defaults."""
        dc = DisplayConfig()
        assert dc.title is None
        assert dc.subtitle is None
        assert dc.help_text is None
        assert dc.tree is None
        assert dc.detail is None
        assert dc.table is None
        assert dc.card is None

    def test_with_title_only(self):
        """DisplayConfig with just title."""
        dc = DisplayConfig(title="Field Title")
        assert dc.title == "Field Title"

    def test_with_template_title(self):
        """DisplayConfig can have template syntax in title."""
        dc = DisplayConfig(title="{name}")
        assert dc.title == "{name}"

    def test_with_view_overrides(self):
        """DisplayConfig with view-specific overrides."""
        dc = DisplayConfig(
            title="Default Title",
            help_text="Default Help",
            tree=ViewDisplay(title="Tree Title"),
            detail=ViewDisplay(title="Detail Title", help_text="Detail Help"),
        )
        assert dc.title == "Default Title"
        assert dc.tree.title == "Tree Title"
        assert dc.tree.help_text is None  # Not overridden
        assert dc.detail.title == "Detail Title"
        assert dc.detail.help_text == "Detail Help"

    def test_all_view_overrides(self):
        """DisplayConfig with all four view overrides."""
        dc = DisplayConfig(
            title="Default",
            tree=ViewDisplay(title="Tree"),
            detail=ViewDisplay(title="Detail"),
            table=ViewDisplay(title="Table"),
            card=ViewDisplay(title="Card"),
        )
        assert dc.tree.title == "Tree"
        assert dc.detail.title == "Detail"
        assert dc.table.title == "Table"
        assert dc.card.title == "Card"

    def test_asdict_with_nested(self):
        """DisplayConfig converts to dict with nested view overrides."""
        dc = DisplayConfig(
            title="Title",
            tree=ViewDisplay(title="Tree Title"),
        )
        d = asdict(dc)
        assert d["title"] == "Title"
        assert d["tree"]["title"] == "Tree Title"


class TestFieldConfigWithDisplay:
    """Tests for FieldConfig using DisplayConfig."""

    def test_field_config_with_display(self):
        """FieldConfig can have DisplayConfig."""
        fc = FieldConfig(
            display=DisplayConfig(
                title="Custom Title",
                help_text="Custom Help",
            )
        )
        assert fc.display is not None
        assert fc.display.title == "Custom Title"
        assert fc.display.help_text == "Custom Help"

    def test_field_config_display_with_views(self):
        """FieldConfig with display containing view overrides."""
        fc = FieldConfig(
            display=DisplayConfig(
                title="Default",
                tree=ViewDisplay(title="Tree View"),
                card=ViewDisplay(subtitle="Card Subtitle"),
            )
        )
        assert fc.display.title == "Default"
        assert fc.display.tree.title == "Tree View"
        assert fc.display.card.subtitle == "Card Subtitle"

    def test_field_config_other_fields(self):
        """FieldConfig still supports other fields alongside display."""
        fc = FieldConfig(
            display=DisplayConfig(title="Title"),
            renderer="text_area",
            placeholder="Enter text",
            hidden=False,
            read_only=True,
        )
        assert fc.display.title == "Title"
        assert fc.renderer == "text_area"
        assert fc.placeholder == "Enter text"
        assert fc.hidden is False
        assert fc.read_only is True


class TestDisplayConfigInModel:
    """Tests for using DisplayConfig in Pydantic model Field definitions."""

    def test_simple_model_with_display_config(self):
        """Model can use FieldConfig with DisplayConfig."""
        from typing import Annotated

        class User(BaseModel):
            name: Annotated[
                str,
                FieldConfig(
                    display=DisplayConfig(
                        title="Full Name",
                        help_text="Enter your full name",
                    )
                ),
            ]
            age: Annotated[
                int,
                FieldConfig(
                    display=DisplayConfig(
                        title="Age",
                        subtitle="Years old",
                    )
                ),
            ] = 0

        # Verify the model still works
        user = User(name="Alice", age=30)
        assert user.name == "Alice"
        assert user.age == 30

    def test_array_items_with_display_template(self):
        """Array items can use template syntax for display."""
        from typing import Annotated

        class Person(BaseModel):
            name: str
            email: str

        class Team(BaseModel):
            members: Annotated[
                list[Person],
                FieldConfig(
                    display=DisplayConfig(
                        title="{name}",  # Template for array items
                        subtitle="{email}",
                    )
                ),
            ]

        # Verify the model works
        team = Team(
            members=[
                Person(name="Alice", email="alice@test.com"),
                Person(name="Bob", email="bob@test.com"),
            ]
        )
        assert len(team.members) == 2

    def test_nested_model_with_view_overrides(self):
        """Nested models can have view-specific display overrides."""
        from typing import Annotated

        class Address(BaseModel):
            city: str
            street: str

        class Person(BaseModel):
            name: str
            address: Annotated[
                Address,
                FieldConfig(
                    display=DisplayConfig(
                        title="Home Address",
                        tree=ViewDisplay(title="Address"),
                        card=ViewDisplay(
                            title="Home Address",
                            subtitle="{city}",
                        ),
                    )
                ),
            ]

        person = Person(
            name="Alice",
            address=Address(city="NYC", street="Main St"),
        )
        assert person.address.city == "NYC"

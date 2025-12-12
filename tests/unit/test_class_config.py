"""Tests for class-based configuration in schema parsing."""

from enum import Enum
from typing import Annotated, NewType

from pydantic import BaseModel

from pydantic_ui import FieldConfig, Renderer
from pydantic_ui.schema import parse_model


class Address(BaseModel):
    street: str
    city: str


Email = NewType("Email", str)


class Color(str, Enum):
    RED = "red"
    BLUE = "blue"


class User(BaseModel):
    name: str
    address: Address
    email: Email
    # Override class config with Annotated
    backup_email: Annotated[Email, FieldConfig(renderer=Renderer.TEXT_INPUT, label="Backup")]
    favorite_color: Color
    tags: Annotated[list[str], FieldConfig(renderer="tag_input")]


def test_class_config_priority():
    """Test that class configs are applied and respected with correct priority."""
    # Define class config for Address
    class_configs = {
        "Address": FieldConfig(renderer="custom_address_renderer", label="Residential Address"),
        "Email": FieldConfig(renderer=Renderer.EMAIL, placeholder="example@example.com"),
        "Color": FieldConfig(renderer=Renderer.SELECT, label="Pick a color"),
    }

    # Parse User model with class_configs
    schema = parse_model(User, class_configs=class_configs)

    # Check Address (Nested Model)
    address_field = schema["fields"]["address"]
    assert address_field.get("ui_config") is not None
    assert address_field["ui_config"]["renderer"] == "custom_address_renderer"
    assert address_field["ui_config"]["label"] == "Residential Address"

    # Check Email (NewType) - Should use class config
    email_field = schema["fields"]["email"]
    assert email_field.get("ui_config") is not None
    assert email_field["ui_config"]["renderer"] == Renderer.EMAIL
    assert email_field["ui_config"]["placeholder"] == "example@example.com"

    # Check Backup Email - Should override class config
    backup_email_field = schema["fields"]["backup_email"]
    assert backup_email_field.get("ui_config") is not None
    assert backup_email_field["ui_config"]["renderer"] == Renderer.TEXT_INPUT
    assert backup_email_field["ui_config"]["label"] == "Backup"
    # Should inherit placeholder from class config (merged)
    assert backup_email_field["ui_config"]["placeholder"] == "example@example.com"

    # Check Color (Enum)
    color_field = schema["fields"]["favorite_color"]
    assert color_field.get("ui_config") is not None
    assert color_field["ui_config"]["label"] == "Pick a color"
    assert color_field["ui_config"]["renderer"] == Renderer.SELECT

    # Check Tags (List) - Annotated config
    tags_field = schema["fields"]["tags"]
    assert tags_field.get("ui_config") is not None
    assert tags_field["ui_config"]["renderer"] == "tag_input"

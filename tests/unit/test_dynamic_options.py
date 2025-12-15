"""Tests for dynamic options configuration."""


import pytest
from pydantic import BaseModel

from pydantic_ui.config import FieldConfig, Renderer, UIConfig
from pydantic_ui.handlers import DataHandler


class User(BaseModel):
    name: str


class Item(BaseModel):
    name: str
    user: str


class Container(BaseModel):
    users: list[User]
    items: list[Item]


class UnionItem(BaseModel):
    field: str | list[str]


class UnionContainer(BaseModel):
    users: list[User]
    items: list[UnionItem]


class TestDynamicOptions:
    """Tests for options_from configuration."""

    @pytest.mark.asyncio
    async def test_options_from_simple_field(self):
        """Test options_from on a simple field."""
        field_configs = {
            "items.[].user": FieldConfig(renderer=Renderer.SELECT, options_from="users.[].name")
        }

        handler = DataHandler(model=Container, ui_config=UIConfig(), field_configs=field_configs)

        schema = await handler.get_schema()

        items_schema = schema["fields"]["items"]
        item_schema = items_schema["items"]
        user_field = item_schema["fields"]["user"]

        assert user_field["ui_config"]["renderer"] == "select"
        assert user_field["ui_config"]["options_from"] == "users.[].name"

    @pytest.mark.asyncio
    async def test_options_from_union_object_field(self):
        """Test options_from on a field inside an object variant of a union."""

        class ObjVariant(BaseModel):
            prop: str

        class UnionContainer2(BaseModel):
            users: list[User]
            data: str | ObjVariant

        field_configs = {
            "data.prop": FieldConfig(renderer=Renderer.SELECT, options_from="users.[].name")
        }

        handler = DataHandler(
            model=UnionContainer2, ui_config=UIConfig(), field_configs=field_configs
        )

        schema = await handler.get_schema()

        data_schema = schema["fields"]["data"]
        assert data_schema["type"] == "union"

        # Find the object variant
        obj_variant = next(v for v in data_schema["variants"] if v["type"] == "object")
        prop_field = obj_variant["fields"]["prop"]

        assert prop_field["ui_config"]["renderer"] == "select"
        assert prop_field["ui_config"]["options_from"] == "users.[].name"

    @pytest.mark.asyncio
    async def test_options_from_nested_union_list(self):
        """Test options_from on a list inside a union."""
        # This corresponds to the user's specific issue:
        # "active_project.tasks.[].other_field.[].name" where other_field is Union

        class SubItem(BaseModel):
            name: str

        class ComplexItem(BaseModel):
            # Union of str and List[SubItem]
            data: str | list[SubItem]

        class Root(BaseModel):
            sources: list[str]
            items: list[ComplexItem]

        field_configs = {
            "items.[].data.[].name": FieldConfig(renderer=Renderer.SELECT, options_from="sources")
        }

        handler = DataHandler(model=Root, ui_config=UIConfig(), field_configs=field_configs)

        schema = await handler.get_schema()

        items_schema = schema["fields"]["items"]
        item_schema = items_schema["items"]
        data_schema = item_schema["fields"]["data"]

        assert data_schema["type"] == "union"

        # Find the list variant
        list_variant = next(v for v in data_schema["variants"] if v["type"] == "array")

        # Check items of the list variant
        subitem_schema = list_variant["items"]
        name_field = subitem_schema["fields"]["name"]

        assert name_field["ui_config"]["renderer"] == "select"
        assert name_field["ui_config"]["options_from"] == "sources"

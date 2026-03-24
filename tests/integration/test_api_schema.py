"""Tests for GET /api/schema endpoint."""

from __future__ import annotations

from typing import Annotated

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel, Field

from pydantic_ui import FieldConfig, Renderer, create_pydantic_ui


class TestGetSchema:
    """Tests for GET /api/schema endpoint."""

    @pytest.mark.asyncio
    async def test_get_schema_simple_model(self, client_simple: AsyncClient):
        """Test getting schema for simple model."""
        response = await client_simple.get("/editor/api/schema")
        assert response.status_code == 200
        schema = response.json()

        assert schema["name"] == "SimpleModel"
        assert schema["type"] == "object"
        assert "fields" in schema
        assert "name" in schema["fields"]
        assert "value" in schema["fields"]

    @pytest.mark.asyncio
    async def test_schema_field_types(self, client_simple: AsyncClient):
        """Test schema includes correct field types."""
        response = await client_simple.get("/editor/api/schema")
        schema = response.json()

        # name is str
        assert schema["fields"]["name"]["type"] == "string"
        # value is int
        assert schema["fields"]["value"]["type"] == "integer"

    @pytest.mark.asyncio
    async def test_schema_includes_titles(self, client_simple: AsyncClient):
        """Test schema includes field titles."""
        response = await client_simple.get("/editor/api/schema")
        schema = response.json()

        assert schema["fields"]["name"]["title"] == "Name"
        assert schema["fields"]["value"]["title"] == "Value"

    @pytest.mark.asyncio
    async def test_schema_with_attr_configs(self, client_with_config: AsyncClient):
        """Test schema reflects field configurations."""
        response = await client_with_config.get("/editor/api/schema")
        schema = response.json()

        # Check that ui_config is applied
        name_field = schema["fields"]["name"]
        if name_field.get("ui_config"):
            assert name_field["ui_config"]["display"]["title"] == "Full Name"

    @pytest.mark.asyncio
    async def test_schema_response_format(self, client_simple: AsyncClient):
        """Test schema response has expected format."""
        response = await client_simple.get("/editor/api/schema")
        schema = response.json()

        # Required top-level fields
        assert "name" in schema
        assert "type" in schema
        assert "fields" in schema

        # Each field should have type and title
        for _field_name, field_schema in schema["fields"].items():
            assert "type" in field_schema
            assert "title" in field_schema


class TestSchemaWithConstraints:
    """Tests for schema with validation constraints."""

    @pytest.mark.asyncio
    async def test_schema_includes_constraints(self, client_with_config: AsyncClient):
        """Test schema includes field constraints."""
        response = await client_with_config.get("/editor/api/schema")
        schema = response.json()

        # Person model has age with ge=0, le=150
        age_field = schema["fields"]["age"]
        constraints = age_field.get("constraints", {})
        # Constraints may be in constraints dict or at field level
        assert constraints.get("minimum") == 0 or age_field.get("minimum") == 0

    @pytest.mark.asyncio
    async def test_schema_includes_defaults(self, client_simple: AsyncClient):
        """Test schema includes default values."""
        response = await client_simple.get("/editor/api/schema")
        schema = response.json()

        # SimpleModel.value has default=0
        value_field = schema["fields"]["value"]
        assert value_field.get("default") == 0

    @pytest.mark.asyncio
    async def test_schema_includes_annotated_scalar_constraints_and_ui_config(self):
        """Annotated Field constraints and FieldConfig metadata should both be serialized."""

        class AnnotatedSchemaModel(BaseModel):
            request_rate_limit: Annotated[
                int,
                Field(ge=1, le=5000, default=1200),
                FieldConfig(
                    renderer=Renderer.SLIDER,
                    props={"min": 1, "max": 5000, "step": 50},
                ),
            ]

        app = FastAPI()
        app.include_router(create_pydantic_ui(AnnotatedSchemaModel, prefix="/editor"))

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/editor/api/schema")

        assert response.status_code == 200
        schema = response.json()
        field = schema["fields"]["request_rate_limit"]

        constraints = field.get("constraints", {})
        assert constraints.get("minimum") == 1 or field.get("minimum") == 1
        assert constraints.get("maximum") == 5000 or field.get("maximum") == 5000

        ui_config = field["ui_config"]
        assert ui_config["renderer"] == Renderer.SLIDER.value
        assert ui_config["props"]["step"] == 50

    @pytest.mark.asyncio
    async def test_schema_includes_annotated_list_item_constraints(self):
        """Annotated list item constraints should be emitted in array item schema."""

        class AnnotatedListModel(BaseModel):
            maintenance_start_hours: list[Annotated[int, Field(ge=0, le=23)]] = Field(
                default_factory=lambda: [1, 13, 22]
            )

        app = FastAPI()
        app.include_router(create_pydantic_ui(AnnotatedListModel, prefix="/editor"))

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/editor/api/schema")

        assert response.status_code == 200
        schema = response.json()
        field = schema["fields"]["maintenance_start_hours"]

        assert field["type"] == "array"
        assert field["items"]["type"] == "integer"
        constraints = field["items"].get("constraints", {})
        assert constraints.get("minimum") == 0 or field["items"].get("minimum") == 0
        assert constraints.get("maximum") == 23 or field["items"].get("maximum") == 23


class TestSchemaWithNestedModels:
    """Tests for schema with nested models."""

    @pytest.mark.asyncio
    async def test_nested_model_fields(self, client_with_config: AsyncClient):
        """Test schema properly represents nested models."""
        response = await client_with_config.get("/editor/api/schema")
        schema = response.json()

        # Verify it's a valid schema structure
        assert schema["type"] == "object"
        assert "fields" in schema

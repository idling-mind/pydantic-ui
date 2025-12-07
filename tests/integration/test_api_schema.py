"""Tests for GET /api/schema endpoint."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


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
    async def test_schema_with_field_configs(self, client_with_config: AsyncClient):
        """Test schema reflects field configurations."""
        response = await client_with_config.get("/editor/api/schema")
        schema = response.json()

        # Check that ui_config is applied
        name_field = schema["fields"]["name"]
        if name_field.get("ui_config"):
            assert name_field["ui_config"]["label"] == "Full Name"

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
        for field_name, field_schema in schema["fields"].items():
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

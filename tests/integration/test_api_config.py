"""Tests for GET /api/config endpoint."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


class TestGetConfig:
    """Tests for GET /api/config endpoint."""

    @pytest.mark.asyncio
    async def test_get_config_defaults(self, client_simple: AsyncClient):
        """Test getting default configuration."""
        response = await client_simple.get("/editor/api/config")
        assert response.status_code == 200
        config = response.json()

        # Check default values
        assert config["title"] == "Data Editor"
        assert config["description"] == ""
        assert config["theme"] == "system"
        assert config["read_only"] is False
        assert config["show_validation"] is True
        assert config["auto_save"] is False
        assert config["auto_save_delay"] == 1000
        assert config["collapsible_tree"] is True
        assert config["show_types"] is True
        assert config["actions"] == []
        assert config["show_save_reset"] is False

    @pytest.mark.asyncio
    async def test_get_config_custom(self, client_with_config: AsyncClient):
        """Test getting custom configuration."""
        response = await client_with_config.get("/editor/api/config")
        assert response.status_code == 200
        config = response.json()

        # Check custom values
        assert config["title"] == "Custom Editor"
        assert config["description"] == "A custom editor"
        assert config["theme"] == "dark"
        assert config["auto_save"] is True
        assert config["auto_save_delay"] == 500
        assert config["show_save_reset"] is True

    @pytest.mark.asyncio
    async def test_config_with_actions(self, client_with_config: AsyncClient):
        """Test configuration includes action buttons."""
        response = await client_with_config.get("/editor/api/config")
        config = response.json()

        assert len(config["actions"]) == 2

        # Check first action (validate)
        validate_action = config["actions"][0]
        assert validate_action["id"] == "validate"
        assert validate_action["label"] == "Validate"
        assert validate_action["variant"] == "secondary"

        # Check second action (export)
        export_action = config["actions"][1]
        assert export_action["id"] == "export"
        assert export_action["label"] == "Export"
        assert export_action["variant"] == "outline"

    @pytest.mark.asyncio
    async def test_config_response_format(self, client_simple: AsyncClient):
        """Test config response has all required fields."""
        response = await client_simple.get("/editor/api/config")
        config = response.json()

        required_fields = [
            "title",
            "description",
            "theme",
            "read_only",
            "show_validation",
            "auto_save",
            "auto_save_delay",
            "collapsible_tree",
            "show_types",
            "actions",
            "show_save_reset",
        ]

        for field in required_fields:
            assert field in config, f"Missing required field: {field}"

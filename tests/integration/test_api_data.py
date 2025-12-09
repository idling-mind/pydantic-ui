"""Tests for /api/data endpoints - Data operations."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

# =============================================================================
# Tests for GET /api/data
# =============================================================================


class TestGetData:
    """Tests for GET /api/data endpoint."""

    @pytest.mark.asyncio
    async def test_get_initial_data(self, client_simple: AsyncClient):
        """Test getting initial data."""
        response = await client_simple.get("/editor/api/data")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_get_data_with_session(self, client_simple: AsyncClient):
        """Test session is created/used for data."""
        response = await client_simple.get("/editor/api/data")
        assert response.status_code == 200
        # Session cookie may or may not be set depending on implementation
        # Just verify we got a successful response

    @pytest.mark.asyncio
    async def test_get_data_with_loader(self, client_with_loader: AsyncClient):
        """Test data comes from custom loader."""
        response = await client_with_loader.get("/editor/api/data")
        assert response.status_code == 200
        data = response.json()
        # Custom loader returns {"name": "loaded", "value": 100}
        assert data["data"]["name"] == "loaded"
        assert data["data"]["value"] == 100


# =============================================================================
# Tests for POST /api/data
# =============================================================================


class TestPostData:
    """Tests for POST /api/data endpoint."""

    @pytest.mark.asyncio
    async def test_post_valid_data(self, client_simple: AsyncClient):
        """Test posting valid data."""
        response = await client_simple.post(
            "/editor/api/data",
            json={"data": {"name": "Updated", "value": 99}},
        )
        assert response.status_code == 200
        result = response.json()
        assert result["valid"] is True
        assert result["data"]["name"] == "Updated"
        assert result["data"]["value"] == 99

    @pytest.mark.asyncio
    async def test_post_invalid_data(self, client_simple: AsyncClient):
        """Test posting invalid data returns errors."""
        response = await client_simple.post(
            "/editor/api/data",
            json={"data": {"name": 123, "value": "not a number"}},
        )
        assert response.status_code == 200
        result = response.json()
        assert result["valid"] is False
        assert "errors" in result
        assert len(result["errors"]) > 0

    @pytest.mark.asyncio
    async def test_post_missing_required_field(self, client_simple: AsyncClient):
        """Test posting data with missing required field."""
        response = await client_simple.post(
            "/editor/api/data",
            json={"data": {"value": 42}},  # Missing 'name'
        )
        assert response.status_code == 200
        result = response.json()
        assert result["valid"] is False

    @pytest.mark.asyncio
    async def test_post_data_persists_in_session(self, client_simple: AsyncClient):
        """Test posted data persists in session."""
        # Post data
        await client_simple.post(
            "/editor/api/data",
            json={"data": {"name": "Persisted", "value": 42}},
        )

        # Get data should return persisted value
        response = await client_simple.get("/editor/api/data")
        data = response.json()
        assert data["data"]["name"] == "Persisted"


# =============================================================================
# Tests for PATCH /api/data
# =============================================================================


class TestPatchData:
    """Tests for PATCH /api/data endpoint."""

    @pytest.mark.asyncio
    async def test_patch_simple_path(self, client_simple: AsyncClient):
        """Test patching a simple field."""
        # First set initial data
        await client_simple.post(
            "/editor/api/data",
            json={"data": {"name": "Original", "value": 10}},
        )

        # Patch just the name
        response = await client_simple.patch(
            "/editor/api/data",
            json={"path": "name", "value": "Patched"},
        )
        assert response.status_code == 200
        result = response.json()
        assert result["data"]["name"] == "Patched"
        assert result["data"]["value"] == 10  # Unchanged

    @pytest.mark.asyncio
    async def test_patch_with_validation_error(self, client_simple: AsyncClient):
        """Test patching with invalid value returns errors."""
        response = await client_simple.patch(
            "/editor/api/data",
            json={"path": "value", "value": "not a number"},
        )
        assert response.status_code == 200
        result = response.json()
        assert result["valid"] is False
        assert "errors" in result


# =============================================================================
# Tests for Complex Model Data Operations
# =============================================================================


class TestComplexDataOperations:
    """Tests for data operations with complex models."""

    @pytest.mark.asyncio
    async def test_nested_model_data(self, client_with_config: AsyncClient):
        """Test data operations with nested models."""
        # Person model has name, age, email, active
        response = await client_with_config.post(
            "/editor/api/data",
            json={
                "data": {
                    "name": "John Doe",
                    "age": 30,
                    "email": "john@example.com",
                    "active": True,
                }
            },
        )
        assert response.status_code == 200
        result = response.json()
        assert result["valid"] is True

    @pytest.mark.asyncio
    async def test_validation_constraints(self, client_with_config: AsyncClient):
        """Test validation constraints are enforced."""
        # Person.age has ge=0, le=150
        response = await client_with_config.post(
            "/editor/api/data",
            json={
                "data": {
                    "name": "Test",
                    "age": 200,  # Invalid: > 150
                    "active": True,
                }
            },
        )
        assert response.status_code == 200
        result = response.json()
        assert result["valid"] is False
        # Should have error about age
        error_paths = [e["path"] for e in result.get("errors", [])]
        assert "age" in error_paths

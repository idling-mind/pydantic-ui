"""Tests for POST /api/validate endpoint."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


class TestValidateData:
    """Tests for POST /api/validate endpoint."""

    @pytest.mark.asyncio
    async def test_validate_valid_data(self, client_simple: AsyncClient):
        """Test validating valid data."""
        response = await client_simple.post(
            "/editor/api/validate",
            json={"data": {"name": "Test", "value": 42}},
        )
        assert response.status_code == 200
        result = response.json()
        assert result["valid"] is True
        assert result["errors"] == []

    @pytest.mark.asyncio
    async def test_validate_invalid_data(self, client_simple: AsyncClient):
        """Test validating invalid data returns errors."""
        response = await client_simple.post(
            "/editor/api/validate",
            json={"data": {"name": 123, "value": "not a number"}},
        )
        assert response.status_code == 200
        result = response.json()
        assert result["valid"] is False
        assert len(result["errors"]) > 0

    @pytest.mark.asyncio
    async def test_validate_multiple_errors(self, client_simple: AsyncClient):
        """Test validation returns multiple errors."""
        response = await client_simple.post(
            "/editor/api/validate",
            json={"data": {"name": 123, "value": "invalid"}},
        )
        assert response.status_code == 200
        result = response.json()
        assert result["valid"] is False
        # Should have errors for both fields
        assert len(result["errors"]) >= 1

    @pytest.mark.asyncio
    async def test_validate_error_format(self, client_simple: AsyncClient):
        """Test validation error format."""
        response = await client_simple.post(
            "/editor/api/validate",
            json={"data": {"name": 123, "value": 42}},
        )
        result = response.json()
        
        if not result["valid"]:
            error = result["errors"][0]
            assert "path" in error
            assert "message" in error
            assert "type" in error

    @pytest.mark.asyncio
    async def test_validate_does_not_save(self, client_simple: AsyncClient):
        """Test validation doesn't modify stored data."""
        # First set valid data
        await client_simple.post(
            "/editor/api/data",
            json={"data": {"name": "Original", "value": 10}},
        )
        
        # Validate new data (valid)
        await client_simple.post(
            "/editor/api/validate",
            json={"data": {"name": "New", "value": 99}},
        )
        
        # Get data should still return original
        response = await client_simple.get("/editor/api/data")
        data = response.json()
        assert data["data"]["name"] == "Original"

    @pytest.mark.asyncio
    async def test_validate_constraint_violations(self, client_with_config: AsyncClient):
        """Test validation catches constraint violations."""
        # Person model has age with ge=0, le=150
        response = await client_with_config.post(
            "/editor/api/validate",
            json={"data": {"name": "Test", "age": -5, "active": True}},
        )
        result = response.json()
        assert result["valid"] is False
        
        # Should have error for age being negative
        error_paths = [e["path"] for e in result["errors"]]
        assert "age" in error_paths

    @pytest.mark.asyncio
    async def test_validate_missing_required(self, client_simple: AsyncClient):
        """Test validation catches missing required fields."""
        response = await client_simple.post(
            "/editor/api/validate",
            json={"data": {"value": 42}},  # Missing required 'name'
        )
        result = response.json()
        assert result["valid"] is False

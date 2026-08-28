"""Tests for create_pydantic_ui router factory function."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from pydantic_ui import (
    DisplayConfig,
    FieldConfig,
    Renderer,
    UIConfig,
    create_pydantic_ui,
)


class SampleModel(BaseModel):
    """Simple test model."""

    name: str
    count: int = 0


class TestCreateRouter:
    """Tests for create_pydantic_ui factory function."""

    def test_create_router_basic(self):
        """Test creating a basic router."""
        router = create_pydantic_ui(SampleModel)
        assert router is not None
        assert hasattr(router, "controller")

    def test_create_router_with_prefix(self):
        """Test creating router with prefix."""
        router = create_pydantic_ui(SampleModel, prefix="/custom")
        assert router.prefix == "/custom"

    def test_create_router_with_config(self):
        """Test creating router with UI config."""
        config = UIConfig(title="Test Editor", theme="dark")
        router = create_pydantic_ui(SampleModel, ui_config=config)
        assert router is not None

    @pytest.mark.asyncio
    async def test_router_serves_endpoints(self):
        """Test router serves all expected endpoints."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Test schema endpoint
            response = await client.get("/test/api/schema")
            assert response.status_code == 200

            # Test config endpoint
            response = await client.get("/test/api/config")
            assert response.status_code == 200

            # Test data endpoint
            response = await client.get("/test/api/data")
            assert response.status_code == 200


class TestRouterDecorators:
    """Tests for router decorator functions."""

    def test_action_decorator(self):
        """Test @router.action decorator registers handler."""
        router = create_pydantic_ui(SampleModel)

        @router.action("custom_action")
        def custom_handler(_data, _controller):
            return {"processed": True}

        # Handler should be registered
        assert hasattr(router, "action")

    @pytest.mark.asyncio
    async def test_action_handler_called(self):
        """Test action handler is called when action triggered."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        handler_called = []

        @router.action("test_action")
        def test_handler(data, _controller):
            handler_called.append(data)
            return {"success": True}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/test/api/actions/test_action",
                json={"data": {"name": "test", "count": 5}},
            )
            assert response.status_code == 200
            result = response.json()
            assert result["success"] is True
            assert len(handler_called) == 1

    @pytest.mark.asyncio
    async def test_async_action_handler(self):
        """Test async action handler works."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        @router.action("async_action")
        async def async_handler(_data, _controller):
            return {"async": True}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/test/api/actions/async_action",
                json={"data": {}},
            )
            assert response.status_code == 200
            result = response.json()
            assert result["result"]["async"] is True

    @pytest.mark.asyncio
    async def test_unknown_action_returns_404(self):
        """Test unknown action returns 404."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/test/api/actions/nonexistent",
                json={"data": {}},
            )
            assert response.status_code == 404


class TestDataLoaderSaver:
    """Tests for data loader and saver callbacks."""

    @pytest.mark.asyncio
    async def test_data_loader_called(self):
        """Test data loader is called for GET /api/data."""
        loader_calls = []

        def custom_loader():
            loader_calls.append(1)
            return SampleModel(name="loaded", count=100)

        app = FastAPI()
        router = create_pydantic_ui(
            SampleModel,
            data_loader=custom_loader,
            prefix="/test",
        )
        app.include_router(router)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/test/api/data")
            assert response.status_code == 200
            data = response.json()
            assert data["data"]["name"] == "loaded"
            assert len(loader_calls) >= 1

    @pytest.mark.asyncio
    async def test_data_saver_called(self):
        """Test data saver is called for POST /api/data."""
        saved_instances = []

        def custom_saver(instance):
            saved_instances.append(instance)

        app = FastAPI()
        router = create_pydantic_ui(
            SampleModel,
            data_saver=custom_saver,
            prefix="/test",
        )
        app.include_router(router)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/test/api/data",
                json={"data": {"name": "saved", "count": 42}},
            )
            assert response.status_code == 200
            assert len(saved_instances) == 1
            assert saved_instances[0].name == "saved"

    def test_data_loader_decorator(self):
        """Test @router.data_loader decorator."""
        router = create_pydantic_ui(SampleModel)

        @router.data_loader
        def load():
            return SampleModel(name="decorated")

        assert hasattr(router, "data_loader")

    def test_data_saver_decorator(self):
        """Test @router.data_saver decorator."""
        router = create_pydantic_ui(SampleModel)

        @router.data_saver
        def save(instance):
            pass

        assert hasattr(router, "data_saver")


class TestInitialData:
    """Tests for initial data handling."""

    @pytest.mark.asyncio
    async def test_initial_data_used(self):
        """Test initial_data is used as starting data."""
        initial = SampleModel(name="initial", count=99)

        app = FastAPI()
        router = create_pydantic_ui(
            SampleModel,
            initial_data=initial,
            prefix="/test",
        )
        app.include_router(router)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/test/api/data")
            data = response.json()
            assert data["data"]["name"] == "initial"
            assert data["data"]["count"] == 99


class TestFieldConfigs:
    """Tests for field configurations."""

    @pytest.mark.asyncio
    async def test_attr_configs_applied(self):
        """Test attr configs are applied to schema."""
        ui_config = UIConfig(
            attr_configs={
                "name": FieldConfig(
                    display=DisplayConfig(title="Full Name"),
                    renderer=Renderer.TEXT_INPUT,
                ),
            }
        )

        app = FastAPI()
        router = create_pydantic_ui(
            SampleModel,
            ui_config=ui_config,
            prefix="/test",
        )
        app.include_router(router)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/test/api/schema")
            schema = response.json()

            name_field = schema["fields"]["name"]
            ui_config_field = name_field.get("ui_config")
            if ui_config_field:
                assert ui_config_field.get("display", {}).get("title") == "Full Name"


class TestStaticServing:
    """Tests for static asset serving, caching headers, and gzip compression."""

    @pytest.mark.asyncio
    async def test_static_index_headers(self):
        """Test index.html has no-cache header and gzip support."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/test/")
            assert response.status_code == 200
            assert "no-cache" in response.headers.get("cache-control", "")

            # Test with gzip header
            gz_response = await client.get("/test/", headers={"accept-encoding": "gzip"})
            assert gz_response.status_code == 200
            if "content-encoding" in gz_response.headers:
                assert gz_response.headers["content-encoding"] == "gzip"

    @pytest.mark.asyncio
    async def test_static_asset_immutable_cache(self):
        """Test static assets have immutable Cache-Control headers."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        from pathlib import Path

        static_assets = Path(__file__).parent.parent.parent / "pydantic_ui" / "static" / "assets"
        js_files = list(static_assets.glob("*.js"))
        if js_files:
            file_name = js_files[0].name
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get(
                    f"/test/assets/{file_name}",
                    headers={"accept-encoding": "gzip"},
                )
                assert response.status_code == 200
                assert "immutable" in response.headers.get("cache-control", "")
                assert "max-age=31536000" in response.headers.get("cache-control", "")
                if (static_assets / f"{file_name}.gz").exists():
                    assert response.headers.get("content-encoding") == "gzip"

    @pytest.mark.asyncio
    async def test_placeholder_index_headers(self):
        """Test placeholder HTML has no-cache header when frontend is not built."""
        from unittest.mock import patch

        with patch("pathlib.Path.exists", return_value=False):
            app = FastAPI()
            router = create_pydantic_ui(SampleModel, prefix="/test")
            app.include_router(router)

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/test/")
                assert response.status_code == 200
                assert "no-cache" in response.headers.get("cache-control", "")
                assert "Frontend not built" in response.text

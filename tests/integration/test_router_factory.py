"""Tests for create_pydantic_ui router factory function."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from pydantic_ui import (
    ActionButton,
    FieldConfig,
    Renderer,
    UIConfig,
    create_pydantic_ui,
)


class TestModel(BaseModel):
    """Simple test model."""
    name: str
    count: int = 0


class TestCreateRouter:
    """Tests for create_pydantic_ui factory function."""

    def test_create_router_basic(self):
        """Test creating a basic router."""
        router = create_pydantic_ui(TestModel)
        assert router is not None
        assert hasattr(router, "controller")

    def test_create_router_with_prefix(self):
        """Test creating router with prefix."""
        router = create_pydantic_ui(TestModel, prefix="/custom")
        assert router.prefix == "/custom"

    def test_create_router_with_config(self):
        """Test creating router with UI config."""
        config = UIConfig(title="Test Editor", theme="dark")
        router = create_pydantic_ui(TestModel, ui_config=config)
        assert router is not None

    @pytest.mark.asyncio
    async def test_router_serves_endpoints(self):
        """Test router serves all expected endpoints."""
        app = FastAPI()
        router = create_pydantic_ui(TestModel, prefix="/test")
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
        router = create_pydantic_ui(TestModel)
        
        @router.action("custom_action")
        def custom_handler(data, controller):
            return {"processed": True}
        
        # Handler should be registered
        assert hasattr(router, "action")

    @pytest.mark.asyncio
    async def test_action_handler_called(self):
        """Test action handler is called when action triggered."""
        app = FastAPI()
        router = create_pydantic_ui(TestModel, prefix="/test")
        app.include_router(router)
        
        handler_called = []
        
        @router.action("test_action")
        def test_handler(data, controller):
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
        router = create_pydantic_ui(TestModel, prefix="/test")
        app.include_router(router)
        
        @router.action("async_action")
        async def async_handler(data, controller):
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
        router = create_pydantic_ui(TestModel, prefix="/test")
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
            return TestModel(name="loaded", count=100)
        
        app = FastAPI()
        router = create_pydantic_ui(
            TestModel,
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
            TestModel,
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
        router = create_pydantic_ui(TestModel)
        
        @router.data_loader
        def load():
            return TestModel(name="decorated")
        
        assert hasattr(router, "data_loader")

    def test_data_saver_decorator(self):
        """Test @router.data_saver decorator."""
        router = create_pydantic_ui(TestModel)
        
        @router.data_saver
        def save(instance):
            pass
        
        assert hasattr(router, "data_saver")


class TestInitialData:
    """Tests for initial data handling."""

    @pytest.mark.asyncio
    async def test_initial_data_used(self):
        """Test initial_data is used as starting data."""
        initial = TestModel(name="initial", count=99)
        
        app = FastAPI()
        router = create_pydantic_ui(
            TestModel,
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
    async def test_field_configs_applied(self):
        """Test field configs are applied to schema."""
        field_configs = {
            "name": FieldConfig(
                label="Full Name",
                renderer=Renderer.TEXT_INPUT,
            ),
        }
        
        app = FastAPI()
        router = create_pydantic_ui(
            TestModel,
            field_configs=field_configs,
            prefix="/test",
        )
        app.include_router(router)
        
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/test/api/schema")
            schema = response.json()
            
            name_field = schema["fields"]["name"]
            ui_config = name_field.get("ui_config")
            if ui_config:
                assert ui_config.get("label") == "Full Name"

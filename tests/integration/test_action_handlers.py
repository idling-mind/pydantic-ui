"""Tests for action handlers in create_pydantic_ui router."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from pydantic_ui import UIConfig, create_pydantic_ui
from pydantic_ui.config import ActionButton
from pydantic_ui.controller import PydanticUIController


class SampleModel(BaseModel):
    """Sample model for action handler tests."""

    name: str = "test"
    value: int = 0


class TestActionHandlers:
    """Tests for custom action handlers."""

    @pytest.mark.asyncio
    async def test_action_handler_receives_data(self):
        """Test action handler receives current data."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        received_data = []

        @router.action("capture")
        def capture_handler(data, _controller):
            received_data.append(data)
            return {"captured": True}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/test/api/actions/capture",
                json={"data": {"name": "captured_name", "value": 99}},
            )

            assert response.status_code == 200
            assert len(received_data) == 1
            assert received_data[0]["name"] == "captured_name"
            assert received_data[0]["value"] == 99

    @pytest.mark.asyncio
    async def test_action_handler_receives_controller(self):
        """Test action handler receives a controller instance."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        controller_received = []

        @router.action("check_controller")
        def check_controller(data, controller):  # noqa: ARG001
            controller_received.append(controller)
            return {"type": type(controller).__name__}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/test/api/actions/check_controller",
                json={"data": {}},
            )

            assert response.status_code == 200
            assert len(controller_received) == 1
            assert isinstance(controller_received[0], PydanticUIController)

    @pytest.mark.asyncio
    async def test_async_action_handler(self):
        """Test async action handler works."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        @router.action("async_action")
        async def async_handler(data, controller):  # noqa: ARG001
            # Simulate async operation
            return {"async": True, "name": data.get("name")}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/test/api/actions/async_action",
                json={"data": {"name": "async_test"}},
            )

            assert response.status_code == 200
            result = response.json()
            assert result["success"] is True
            assert result["result"]["async"] is True
            assert result["result"]["name"] == "async_test"

    @pytest.mark.asyncio
    async def test_action_handler_with_toast(self):
        """Test action handler can send toast."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        @router.action("toast_action")
        async def toast_action(data, controller: PydanticUIController):  # noqa: ARG001
            await controller.show_toast("Action completed!", "success")
            return {"toast_sent": True}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/test/api/actions/toast_action",
                json={"data": {}},
            )

            assert response.status_code == 200
            result = response.json()
            assert result["result"]["toast_sent"] is True

    @pytest.mark.asyncio
    async def test_action_handler_with_validation_errors(self):
        """Test action handler can push validation errors."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        @router.action("validate")
        async def validate_action(data, controller: PydanticUIController):
            errors = []
            if not data.get("name"):
                errors.append({"path": "name", "message": "Name is required"})
            if data.get("value", 0) < 0:
                errors.append({"path": "value", "message": "Value must be non-negative"})

            if errors:
                await controller.show_validation_errors(errors)
                return {"valid": False, "error_count": len(errors)}
            return {"valid": True}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Test with invalid data
            response = await client.post(
                "/test/api/actions/validate",
                json={"data": {"name": "", "value": -5}},
            )

            assert response.status_code == 200
            result = response.json()
            assert result["result"]["valid"] is False
            assert result["result"]["error_count"] == 2

    @pytest.mark.asyncio
    async def test_action_handler_with_data_push(self):
        """Test action handler can push new data."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        @router.action("transform")
        async def transform_action(data, controller: PydanticUIController):
            new_data = {
                "name": data.get("name", "").upper(),
                "value": data.get("value", 0) * 2,
            }
            await controller.push_data(new_data)
            return {"transformed": True}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/test/api/actions/transform",
                json={"data": {"name": "hello", "value": 5}},
            )

            assert response.status_code == 200
            result = response.json()
            assert result["result"]["transformed"] is True

    @pytest.mark.asyncio
    async def test_action_handler_exception(self):
        """Test action handler exception returns 400."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        @router.action("failing")
        def failing_action(data, controller):  # noqa: ARG001
            raise ValueError("Something went wrong")

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/test/api/actions/failing",
                json={"data": {}},
            )

            assert response.status_code == 400
            result = response.json()
            assert result["success"] is False
            assert "Something went wrong" in result["error"]

    @pytest.mark.asyncio
    async def test_unknown_action_returns_404(self):
        """Test unknown action ID returns 404."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/test/api/actions/unknown_action",
                json={"data": {}},
            )

            assert response.status_code == 404
            result = response.json()
            assert "Unknown action" in result["error"]

    @pytest.mark.asyncio
    async def test_multiple_action_handlers(self):
        """Test multiple action handlers can be registered."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        @router.action("action1")
        def action1(data, controller):  # noqa: ARG001
            return {"action": 1}

        @router.action("action2")
        def action2(data, controller):  # noqa: ARG001
            return {"action": 2}

        @router.action("action3")
        def action3(data, controller):  # noqa: ARG001
            return {"action": 3}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            for i in range(1, 4):
                response = await client.post(
                    f"/test/api/actions/action{i}",
                    json={"data": {}},
                )
                assert response.status_code == 200
                result = response.json()
                assert result["result"]["action"] == i

    @pytest.mark.asyncio
    async def test_background_task_toast(self):
        """Test sending toast from a background task."""
        import asyncio

        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        # Event to signal background task completion
        task_done = asyncio.Event()

        @router.action("background_toast")
        async def background_handler(data, controller):  # noqa: ARG001
            async def delayed_toast():
                await asyncio.sleep(0.1)
                await controller.show_toast("Background Toast", "success")
                task_done.set()

            asyncio.create_task(delayed_toast())
            return {"started": True}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Establish session
            resp = await client.get("/test/api/session")
            session_id = resp.json()["session_id"]
            client.cookies.set("pydantic_ui_session", session_id)

            # 2. Trigger action
            response = await client.post(
                "/test/api/actions/background_toast",
                json={"data": {}},
            )
            assert response.status_code == 200
            assert response.json()["result"]["started"] is True

            # 3. Wait for background task
            await asyncio.wait_for(task_done.wait(), timeout=1.0)

            # 4. Check events via polling
            events_resp = await client.get("/test/api/events/poll?since=0")
            events = events_resp.json()["events"]

            toast_events = [e for e in events if e["type"] == "toast"]
            assert len(toast_events) >= 1
            assert toast_events[0]["payload"]["message"] == "Background Toast"


class TestActionButtonConfig:
    """Tests for ActionButton configuration."""

    @pytest.mark.asyncio
    async def test_action_buttons_in_config(self):
        """Test action buttons appear in UI config."""
        ui_config = UIConfig(
            title="Test",
            actions=[
                ActionButton(
                    id="validate",
                    label="Validate",
                    variant="secondary",
                    icon="check",
                    tooltip="Validate data",
                ),
                ActionButton(
                    id="export",
                    label="Export",
                    variant="outline",
                    confirm="Are you sure you want to export?",
                ),
            ],
        )

        app = FastAPI()
        router = create_pydantic_ui(SampleModel, ui_config=ui_config, prefix="/test")
        app.include_router(router)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/test/api/config")

            assert response.status_code == 200
            config = response.json()
            assert len(config["actions"]) == 2

            validate_btn = config["actions"][0]
            assert validate_btn["id"] == "validate"
            assert validate_btn["label"] == "Validate"
            assert validate_btn["variant"] == "secondary"
            assert validate_btn["icon"] == "check"
            assert validate_btn["tooltip"] == "Validate data"

            export_btn = config["actions"][1]
            assert export_btn["id"] == "export"
            assert export_btn["confirm"] == "Are you sure you want to export?"

    def test_action_button_defaults(self):
        """Test ActionButton default values."""
        btn = ActionButton(id="test", label="Test")
        assert btn.variant == "default"
        assert btn.icon is None
        assert btn.disabled is False
        assert btn.tooltip is None
        assert btn.confirm is None

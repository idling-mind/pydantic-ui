"""Tests for SSE events and session endpoints."""

from __future__ import annotations

import asyncio

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from pydantic_ui import create_pydantic_ui


class SampleModel(BaseModel):
    """Test model for SSE tests."""

    name: str = "test"
    value: int = 0


class TestSessionEndpoints:
    """Tests for session management endpoints."""

    @pytest.mark.asyncio
    async def test_get_session_creates_new(self):
        """Test GET /api/session creates a new session."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/test/api/session")

            assert response.status_code == 200
            data = response.json()
            assert "session_id" in data
            assert len(data["session_id"]) == 36  # UUID format

            # Check cookie is set
            assert "pydantic_ui_session" in response.cookies

    @pytest.mark.asyncio
    async def test_session_persistence(self):
        """Test session persists across requests."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # First request - create session
            response1 = await client.get("/test/api/session")
            session_id1 = response1.json()["session_id"]

            # Store cookie
            cookies = response1.cookies

            # Second request with same cookie
            response2 = await client.get(
                "/test/api/session",
                cookies=cookies,
            )
            session_id2 = response2.json()["session_id"]

            assert session_id1 == session_id2

    @pytest.mark.asyncio
    async def test_data_isolation_between_sessions(self):
        """Test data is isolated between sessions."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        transport = ASGITransport(app=app)

        # Use separate clients to ensure cookie isolation
        async with AsyncClient(transport=transport, base_url="http://test") as client1:
            # Session 1: Create and update data
            response1 = await client1.get("/test/api/session")
            cookies1 = response1.cookies

            await client1.post(
                "/test/api/data",
                json={"data": {"name": "session1", "value": 111}},
                cookies=cookies1,
            )

            # Verify session 1 data
            get1 = await client1.get("/test/api/data", cookies=cookies1)
            data1 = get1.json()["data"]
            assert data1["name"] == "session1"

        async with AsyncClient(transport=transport, base_url="http://test") as client2:
            # Session 2: Create new session (fresh client, no cookies)
            response2 = await client2.get("/test/api/session")
            cookies2 = response2.cookies

            # Session 2 should have default data, not session 1's data
            get2 = await client2.get("/test/api/data", cookies=cookies2)
            data2 = get2.json()["data"]

            # Should be default values, not session1's values
            assert data2["name"] == "test"  # default value
            assert data2["value"] == 0  # default value


class TestEventPolling:
    """Tests for event polling endpoint."""

    @pytest.mark.asyncio
    async def test_poll_events_empty(self):
        """Test polling returns empty when no events."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Create session first
            session_resp = await client.get("/test/api/session")
            cookies = session_resp.cookies

            response = await client.get(
                "/test/api/events/poll",
                params={"since": 0},
                cookies=cookies,
            )

            assert response.status_code == 200
            data = response.json()
            assert "events" in data
            assert len(data["events"]) == 0

    @pytest.mark.asyncio
    async def test_poll_events_after_action(self):
        """Test polling returns events after action triggers them."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        @router.action("send_toast")
        async def send_toast(data, controller):  # noqa: ARG001
            await controller.show_toast("Test message", "success")
            return {"sent": True}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Create session
            session_resp = await client.get("/test/api/session")
            cookies = session_resp.cookies

            # Trigger action that sends toast
            await client.post(
                "/test/api/actions/send_toast",
                json={"data": {}},
                cookies=cookies,
            )

            # Poll for events
            response = await client.get(
                "/test/api/events/poll",
                params={"since": 0},
                cookies=cookies,
            )

            data = response.json()
            events = data["events"]
            assert len(events) >= 1

            toast_event = next((e for e in events if e["type"] == "toast"), None)
            assert toast_event is not None
            assert toast_event["payload"]["message"] == "Test message"
            assert toast_event["payload"]["type"] == "success"


class TestConfirmationEndpoint:
    """Tests for confirmation dialog endpoint."""

    @pytest.mark.asyncio
    async def test_confirmation_endpoint_exists(self):
        """Test confirmation endpoint exists."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Create session
            session_resp = await client.get("/test/api/session")
            cookies = session_resp.cookies

            response = await client.post(
                "/test/api/confirmation/test-id",
                json={"confirmed": True},
                cookies=cookies,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["ok"] is True

    @pytest.mark.asyncio
    async def test_confirmation_flow(self):
        """Test full confirmation flow."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        confirmation_result = []

        @router.action("confirm_action")
        async def confirm_action(data, controller):  # noqa: ARG001
            result = await asyncio.wait_for(
                controller.request_confirmation(
                    "Are you sure?",
                    title="Confirm",
                ),
                timeout=5.0,
            )
            confirmation_result.append(result)
            return {"confirmed": result}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Create session
            session_resp = await client.get("/test/api/session")
            cookies = session_resp.cookies

            # Start action in background (it will wait for confirmation)
            async def trigger_action():
                return await client.post(
                    "/test/api/actions/confirm_action",
                    json={"data": {}},
                    cookies=cookies,
                )

            action_task = asyncio.create_task(trigger_action())

            # Wait a bit for action to start and send confirmation request
            await asyncio.sleep(0.1)

            # Poll for the confirmation request
            poll_resp = await client.get(
                "/test/api/events/poll",
                params={"since": 0},
                cookies=cookies,
            )
            events = poll_resp.json()["events"]
            confirm_event = next(
                (e for e in events if e["type"] == "confirmation_request"), None
            )

            if confirm_event:
                # Respond to confirmation
                confirm_id = confirm_event["payload"]["id"]
                await client.post(
                    f"/test/api/confirmation/{confirm_id}",
                    json={"confirmed": True},
                    cookies=cookies,
                )

            # Wait for action to complete
            response = await action_task

            assert response.status_code == 200
            result = response.json()
            assert result["success"] is True
            assert result["result"]["confirmed"] is True


class TestSSEEndpoint:
    """Tests for SSE endpoint (basic functionality)."""

    @pytest.mark.asyncio
    async def test_sse_endpoint_exists(self):
        """Test SSE endpoint exists and returns correct content type."""
        app = FastAPI()
        router = create_pydantic_ui(SampleModel, prefix="/test")
        app.include_router(router)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test", timeout=2.0) as client:
            # Note: Full SSE testing requires different approach
            # Here we just verify the endpoint exists and has correct headers
            try:
                async with asyncio.timeout(1.0):
                    async with client.stream("GET", "/test/api/events") as response:
                        assert response.status_code == 200
                        assert "text/event-stream" in response.headers.get("content-type", "")
                        # Read a small chunk then exit - SSE streams indefinitely
                        await response.aread()
            except asyncio.TimeoutError:
                # Expected - SSE endpoint streams forever, timeout is normal
                pass

"""Tests for pydantic_ui/controller.py - PydanticUIController class."""

from __future__ import annotations

import asyncio

import pytest
from pydantic import BaseModel

from pydantic_ui.controller import PydanticUIController
from pydantic_ui.sessions import Session, SessionManager


class SimpleModel(BaseModel):
    """Simple test model."""

    name: str = "test"
    value: int = 0


class TestPydanticUIController:
    """Tests for PydanticUIController class."""

    @pytest.fixture
    def session_manager(self) -> SessionManager:
        """Create a session manager for tests."""
        return SessionManager()

    @pytest.fixture
    async def session(self, session_manager: SessionManager) -> Session:
        """Create a session for tests."""
        session, _ = await session_manager.get_or_create_session(
            "test-session", {"name": "test", "value": 42}
        )
        return session

    @pytest.fixture
    def controller(self, session_manager: SessionManager) -> PydanticUIController:
        """Create a controller for tests."""
        return PydanticUIController(session_manager, SimpleModel)

    def test_controller_creation(self, session_manager: SessionManager):
        """Test controller can be created."""
        controller = PydanticUIController(session_manager, SimpleModel)
        assert controller._session_manager == session_manager
        assert controller._model == SimpleModel
        assert controller._current_session is None

    @pytest.mark.asyncio
    async def test_get_session_raises_without_session(self, controller: PydanticUIController):
        """Test _get_session raises when no session is set."""
        with pytest.raises(RuntimeError, match="No session is set"):
            await controller._get_session()

    @pytest.mark.asyncio
    async def test_show_validation_errors(self, controller: PydanticUIController, session: Session):
        """Test showing validation errors pushes event to session."""
        controller._current_session = session

        errors = [
            {"path": "name", "message": "Name is required"},
            {"path": "value", "message": "Value must be positive"},
        ]
        await controller.show_validation_errors(errors)

        # Check event was pushed
        assert len(session.events) == 1
        event = session.events[0]
        assert event["type"] == "validation_errors"
        assert event["payload"]["errors"] == errors

    @pytest.mark.asyncio
    async def test_clear_validation_errors(
        self, controller: PydanticUIController, session: Session
    ):
        """Test clearing validation errors."""
        controller._current_session = session

        await controller.clear_validation_errors()

        assert len(session.events) == 1
        event = session.events[0]
        assert event["type"] == "clear_validation_errors"
        assert event["payload"] == {}

    @pytest.mark.asyncio
    async def test_push_data_with_dict(self, controller: PydanticUIController, session: Session):
        """Test pushing data as dict."""
        controller._current_session = session

        new_data = {"name": "updated", "value": 100}
        await controller.push_data(new_data)

        # Check session data was updated
        assert session.data == new_data

        # Check event was pushed
        assert len(session.events) == 1
        event = session.events[0]
        assert event["type"] == "push_data"
        assert event["payload"]["data"] == new_data

    @pytest.mark.asyncio
    async def test_push_data_with_model(self, controller: PydanticUIController, session: Session):
        """Test pushing data as Pydantic model."""
        controller._current_session = session

        model_instance = SimpleModel(name="model_data", value=999)
        await controller.push_data(model_instance)

        # Check session data was updated (as dict)
        assert session.data == {"name": "model_data", "value": 999}

        # Check event was pushed
        assert len(session.events) == 1
        event = session.events[0]
        assert event["type"] == "push_data"
        assert event["payload"]["data"]["name"] == "model_data"

    @pytest.mark.asyncio
    async def test_show_toast(self, controller: PydanticUIController, session: Session):
        """Test showing toast notification."""
        controller._current_session = session

        await controller.show_toast("Hello!", "success", duration=3000)

        assert len(session.events) == 1
        event = session.events[0]
        assert event["type"] == "toast"
        assert event["payload"]["message"] == "Hello!"
        assert event["payload"]["type"] == "success"
        assert event["payload"]["duration"] == 3000

    @pytest.mark.asyncio
    async def test_show_toast_defaults(self, controller: PydanticUIController, session: Session):
        """Test toast with default values."""
        controller._current_session = session

        await controller.show_toast("Default toast")

        event = session.events[0]
        assert event["payload"]["type"] == "info"
        assert event["payload"]["duration"] == 5000

    @pytest.mark.asyncio
    async def test_request_confirmation_confirmed(
        self, controller: PydanticUIController, session: Session
    ):
        """Test confirmation dialog when user confirms."""
        controller._current_session = session

        # Start confirmation request in background
        async def confirm_later():
            await asyncio.sleep(0.01)
            # Find the confirmation ID from the event
            event = session.events[0]
            confirmation_id = event["payload"]["id"]
            # Resolve the confirmation
            future = session.pending_confirmations.get(confirmation_id)
            if future and not future.done():
                future.set_result(True)

        asyncio.create_task(confirm_later())

        result = await controller.request_confirmation(
            "Are you sure?",
            title="Confirm Action",
            confirm_text="Yes",
            cancel_text="No",
            variant="destructive",
        )

        assert result is True

        # Check event was pushed
        event = session.events[0]
        assert event["type"] == "confirmation_request"
        assert event["payload"]["message"] == "Are you sure?"
        assert event["payload"]["title"] == "Confirm Action"
        assert event["payload"]["confirm_text"] == "Yes"
        assert event["payload"]["cancel_text"] == "No"
        assert event["payload"]["variant"] == "destructive"

    @pytest.mark.asyncio
    async def test_request_confirmation_cancelled(
        self, controller: PydanticUIController, session: Session
    ):
        """Test confirmation dialog when user cancels."""
        controller._current_session = session

        async def cancel_later():
            await asyncio.sleep(0.01)
            event = session.events[0]
            confirmation_id = event["payload"]["id"]
            future = session.pending_confirmations.get(confirmation_id)
            if future and not future.done():
                future.set_result(False)

        asyncio.create_task(cancel_later())

        result = await controller.request_confirmation("Delete all?")
        assert result is False

    @pytest.mark.asyncio
    async def test_refresh(self, controller: PydanticUIController, session: Session):
        """Test refresh event."""
        controller._current_session = session

        await controller.refresh()

        assert len(session.events) == 1
        event = session.events[0]
        assert event["type"] == "refresh"
        assert event["payload"] == {}

    def test_get_current_data_with_session(
        self, controller: PydanticUIController, session: Session
    ):
        """Test getting current data from session."""
        controller._current_session = session
        session.data = {"name": "current", "value": 123}

        data = controller.get_current_data()
        assert data == {"name": "current", "value": 123}

    def test_get_current_data_without_session(self, controller: PydanticUIController):
        """Test getting current data without session returns empty dict."""
        data = controller.get_current_data()
        assert data == {}

    def test_get_model_instance_valid(self, controller: PydanticUIController, session: Session):
        """Test getting model instance with valid data."""
        controller._current_session = session
        session.data = {"name": "test", "value": 42}

        instance = controller.get_model_instance()
        assert instance is not None
        assert isinstance(instance, SimpleModel)
        assert instance.name == "test"
        assert instance.value == 42

    def test_get_model_instance_invalid(self, controller: PydanticUIController, session: Session):
        """Test getting model instance with invalid data returns None."""
        controller._current_session = session
        session.data = {"name": 123}  # Invalid type

        instance = controller.get_model_instance()
        assert instance is None

    @pytest.mark.asyncio
    async def test_navigate_to(self, controller: PydanticUIController, session: Session):
        """Test navigating to a URL."""
        controller._current_session = session

        await controller.navigate_to("https://example.com")

        assert len(session.events) == 1
        event = session.events[0]
        assert event["type"] == "navigate"
        assert event["payload"]["url"] == "https://example.com"
        assert event["payload"]["new_tab"] is False

        await controller.navigate_to("/local", new_tab=True)
        assert len(session.events) == 2
        event = session.events[1]
        assert event["type"] == "navigate"
        assert event["payload"]["url"] == "/local"
        assert event["payload"]["new_tab"] is True

    @pytest.mark.asyncio
    async def test_broadcast_toast(
        self, controller: PydanticUIController, session_manager: SessionManager
    ):
        """Test broadcasting toast to all sessions."""
        # Create multiple sessions
        session1, _ = await session_manager.get_or_create_session("s1", {})
        session2, _ = await session_manager.get_or_create_session("s2", {})

        await controller.broadcast_toast("Global message", "warning", 10000)

        # Both sessions should have the event
        assert len(session1.events) == 1
        assert len(session2.events) == 1
        assert session1.events[0]["payload"]["message"] == "Global message"
        assert session2.events[0]["payload"]["type"] == "warning"

    @pytest.mark.asyncio
    async def test_broadcast_refresh(
        self, controller: PydanticUIController, session_manager: SessionManager
    ):
        """Test broadcasting refresh to all sessions."""
        session1, _ = await session_manager.get_or_create_session("s1", {})
        session2, _ = await session_manager.get_or_create_session("s2", {})

        await controller.broadcast_refresh()

        assert len(session1.events) == 1
        assert len(session2.events) == 1
        assert session1.events[0]["type"] == "refresh"
        assert session2.events[0]["type"] == "refresh"

    def test_resolve_confirmation(self, controller: PydanticUIController, session: Session):
        """Test resolving confirmation with deprecated method."""
        controller._current_session = session

        # Create a pending confirmation
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        future: asyncio.Future[bool] = loop.create_future()
        session.pending_confirmations["test-id"] = future

        controller.resolve_confirmation("test-id", True)

        assert future.done()
        assert future.result() is True
        loop.close()

    @pytest.mark.asyncio
    async def test_get_session_from_context(
        self, controller: PydanticUIController, session: Session
    ):
        """Test _get_session retrieves from context var."""
        from pydantic_ui.sessions import current_session

        token = current_session.set(session)
        try:
            # Ensure instance var is None to prove we're using context
            controller._current_session = None
            retrieved = await controller._get_session()
            assert retrieved is session
        finally:
            current_session.reset(token)

"""Tests for pydantic_ui/sessions.py - Session management."""

from __future__ import annotations

import asyncio
import time

import pytest

from pydantic_ui.sessions import Session, SessionManager

# =============================================================================
# Tests for Session
# =============================================================================


class TestSession:
    """Tests for Session class."""

    def test_session_creation(self):
        """Test session creation with defaults."""
        session = Session(id="test-123")
        assert session.id == "test-123"
        assert session.data == {}
        assert len(session.events) == 0
        assert len(session.subscribers) == 0
        assert len(session.pending_confirmations) == 0

    def test_session_creation_with_data(self):
        """Test session creation with initial data."""
        initial_data = {"name": "test", "value": 42}
        session = Session(id="test-123", data=initial_data)
        assert session.data == initial_data

    @pytest.mark.asyncio
    async def test_push_event(self):
        """Test pushing an event to session."""
        session = Session(id="test-123")
        await session.push_event("toast", {"message": "Hello"})
        assert len(session.events) == 1
        event = session.events[0]
        assert event["type"] == "toast"
        assert event["payload"] == {"message": "Hello"}
        assert "timestamp" in event

    @pytest.mark.asyncio
    async def test_push_event_to_subscribers(self):
        """Test events are pushed to subscribers."""
        session = Session(id="test-123")

        received_events = []

        async def collect_events():
            async for event in session.subscribe():
                received_events.append(event)
                if len(received_events) >= 2:
                    break

        # Start collecting in background
        task = asyncio.create_task(collect_events())
        await asyncio.sleep(0.01)  # Let subscriber start

        # Push events
        await session.push_event("toast", {"message": "First"})
        await session.push_event("toast", {"message": "Second"})

        await asyncio.wait_for(task, timeout=1.0)

        assert len(received_events) == 2
        assert received_events[0]["payload"]["message"] == "First"
        assert received_events[1]["payload"]["message"] == "Second"

    @pytest.mark.asyncio
    async def test_get_pending_events(self):
        """Test getting pending events since timestamp."""
        session = Session(id="test-123")

        # Push first event
        await session.push_event("event1", {})
        await asyncio.sleep(0.01)
        mid_time = time.time()
        await asyncio.sleep(0.01)

        # Push second event
        await session.push_event("event2", {})

        # Get events since mid_time
        events = await session.get_pending_events(mid_time)
        assert len(events) == 1
        assert events[0]["type"] == "event2"

    def test_touch(self):
        """Test touch updates last activity."""
        session = Session(id="test-123")
        original_time = session.last_activity
        time.sleep(0.01)
        session.touch()
        assert session.last_activity > original_time

    @pytest.mark.asyncio
    async def test_event_queue_max_size(self):
        """Test event queue respects max size."""
        session = Session(id="test-123")
        # Default maxlen is 100
        for i in range(150):
            await session.push_event(f"event{i}", {})

        assert len(session.events) == 100
        # Oldest events should be dropped
        assert session.events[0]["type"] == "event50"

    @pytest.mark.asyncio
    async def test_multiple_subscribers(self):
        """Test multiple subscribers receive events."""
        session = Session(id="test-123")

        received1 = []
        received2 = []

        async def subscriber1():
            async for event in session.subscribe():
                received1.append(event)
                if len(received1) >= 1:
                    break

        async def subscriber2():
            async for event in session.subscribe():
                received2.append(event)
                if len(received2) >= 1:
                    break

        task1 = asyncio.create_task(subscriber1())
        task2 = asyncio.create_task(subscriber2())
        await asyncio.sleep(0.01)

        await session.push_event("test", {"data": "shared"})

        await asyncio.wait_for(asyncio.gather(task1, task2), timeout=1.0)

        assert len(received1) == 1
        assert len(received2) == 1
        assert received1[0]["payload"] == received2[0]["payload"]


# =============================================================================
# Tests for SessionManager
# =============================================================================


class TestSessionManager:
    """Tests for SessionManager class."""

    def test_create_session_id(self):
        """Test creating unique session IDs."""
        manager = SessionManager()
        id1 = manager.create_session_id()
        id2 = manager.create_session_id()
        assert id1 != id2
        assert len(id1) == 36  # UUID format

    @pytest.mark.asyncio
    async def test_get_or_create_new(self):
        """Test creating a new session."""
        manager = SessionManager()
        session, is_new = await manager.get_or_create_session(
            None, {"initial": "data"}
        )
        assert is_new is True
        assert session.data == {"initial": "data"}

    @pytest.mark.asyncio
    async def test_get_or_create_existing(self):
        """Test getting an existing session."""
        manager = SessionManager()

        # Create session
        session1, is_new1 = await manager.get_or_create_session(
            "fixed-id", {"initial": "data"}
        )
        assert is_new1 is True

        # Get same session
        session2, is_new2 = await manager.get_or_create_session(
            "fixed-id", {"different": "data"}
        )
        assert is_new2 is False
        assert session1.id == session2.id
        # Original data should be preserved
        assert session2.data == {"initial": "data"}

    @pytest.mark.asyncio
    async def test_get_session(self):
        """Test getting session by ID."""
        manager = SessionManager()

        # Create session
        session, _ = await manager.get_or_create_session("test-id", {})

        # Get session
        retrieved = await manager.get_session("test-id")
        assert retrieved is not None
        assert retrieved.id == "test-id"

    @pytest.mark.asyncio
    async def test_get_session_not_found(self):
        """Test getting non-existent session returns None."""
        manager = SessionManager()
        result = await manager.get_session("non-existent")
        assert result is None

    @pytest.mark.asyncio
    async def test_remove_session(self):
        """Test removing a session."""
        manager = SessionManager()

        # Create and remove session
        await manager.get_or_create_session("test-id", {})
        assert manager.session_count == 1

        await manager.remove_session("test-id")
        assert manager.session_count == 0

        # Session should no longer exist
        result = await manager.get_session("test-id")
        assert result is None

    @pytest.mark.asyncio
    async def test_cleanup_inactive_sessions(self):
        """Test cleaning up inactive sessions."""
        # Short timeout for testing
        manager = SessionManager(session_timeout=0.01)

        # Create session
        await manager.get_or_create_session("old-session", {})
        assert manager.session_count == 1

        # Wait for timeout
        await asyncio.sleep(0.02)

        # Cleanup
        removed = await manager.cleanup_inactive_sessions()
        assert removed == 1
        assert manager.session_count == 0

    @pytest.mark.asyncio
    async def test_cleanup_preserves_active(self):
        """Test cleanup preserves active sessions."""
        manager = SessionManager(session_timeout=0.05)

        # Create two sessions
        session1, _ = await manager.get_or_create_session("session-1", {})
        await manager.get_or_create_session("session-2", {})

        # Wait partial timeout
        await asyncio.sleep(0.03)

        # Touch session-1 to keep it active
        session1.touch()

        # Wait more
        await asyncio.sleep(0.03)

        # Cleanup should remove only session-2
        removed = await manager.cleanup_inactive_sessions()
        assert removed == 1
        assert manager.session_count == 1

        result = await manager.get_session("session-1")
        assert result is not None

    def test_session_count(self):
        """Test session count property."""
        manager = SessionManager()
        assert manager.session_count == 0

    @pytest.mark.asyncio
    async def test_broadcast_event(self):
        """Test broadcasting event to all sessions."""
        manager = SessionManager()

        # Create multiple sessions
        session1, _ = await manager.get_or_create_session("session-1", {})
        session2, _ = await manager.get_or_create_session("session-2", {})

        # Broadcast event
        await manager.broadcast_event("global_toast", {"message": "Hello all"})

        # Both sessions should have the event
        assert len(session1.events) == 1
        assert len(session2.events) == 1
        assert session1.events[0]["type"] == "global_toast"
        assert session2.events[0]["payload"]["message"] == "Hello all"

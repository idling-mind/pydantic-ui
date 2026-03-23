"""Session management for Pydantic UI."""

import asyncio
import time
import uuid
from collections.abc import AsyncGenerator
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any, Optional

from pydantic_ui.events import EventQueue

# Context variable to store the current session
current_session: ContextVar[Optional["Session"]] = ContextVar("current_session", default=None)


@dataclass
class Session:
    """Represents a single browser session.

    Each session has its own:
    - Event queue for SSE events (delegated to :class:`EventQueue`)
    - Data state (copy of the original data)
    - Pending confirmations
    """

    id: str
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    data: dict[str, Any] = field(default_factory=dict)
    _event_queue: EventQueue = field(default_factory=EventQueue)
    pending_confirmations: dict[str, asyncio.Future] = field(default_factory=dict)  # type: ignore

    @property
    def events(self) -> Any:
        """Access the underlying event deque (kept for backward compatibility)."""
        return self._event_queue.events

    @property
    def subscribers(self) -> list[asyncio.Queue]:  # type: ignore
        """Access the underlying subscriber list (kept for backward compatibility)."""
        return self._event_queue.subscribers

    async def push_event(self, event_type: str, payload: dict[str, Any] | None = None) -> None:
        """Push an event to this session's subscribers.

        Args:
            event_type: Type of event (e.g., 'toast', 'validation_errors')
            payload: Event data dictionary
        """
        await self._event_queue.push(event_type, payload)

    async def subscribe(self) -> AsyncGenerator[dict[str, Any], None]:
        """Subscribe to events via SSE.

        Yields:
            Event dictionaries as they are pushed.
        """
        async for event in self._event_queue.subscribe():
            yield event

    async def get_pending_events(self, since: float = 0) -> list[dict[str, Any]]:
        """Get events since a timestamp (for polling fallback).

        Args:
            since: Unix timestamp. Only events after this time are returned.

        Returns:
            List of event dictionaries.
        """
        return await self._event_queue.get_pending(since)

    def touch(self) -> None:
        """Update the last activity timestamp."""
        self.last_activity = time.time()


class SessionManager:
    """Manages all active sessions.

    Provides session creation, retrieval, and cleanup functionality.
    Sessions are automatically cleaned up after a period of inactivity.

    Example:
        manager = SessionManager()

        # Create or get a session
        session = manager.get_or_create_session(session_id)

        # Push an event to a specific session
        await session.push_event("toast", {"message": "Hello!"})

        # Clean up old sessions
        manager.cleanup_inactive_sessions()
    """

    def __init__(self, session_timeout: float = 3600):
        """Initialize the session manager.

        Args:
            session_timeout: Seconds of inactivity before a session is removed (default 1 hour)
        """
        self._sessions: dict[str, Session] = {}
        self._lock = asyncio.Lock()
        self._session_timeout = session_timeout

    def create_session_id(self) -> str:
        """Generate a new unique session ID."""
        return str(uuid.uuid4())

    async def get_or_create_session(
        self, session_id: str | None, initial_data: dict[str, Any] | None = None
    ) -> tuple[Session, bool]:
        """Get an existing session or create a new one.

        Args:
            session_id: The session ID, or None to create a new session
            initial_data: Initial data for new sessions

        Returns:
            Tuple of (session, is_new) where is_new indicates if session was created
        """
        async with self._lock:
            if session_id and session_id in self._sessions:
                session = self._sessions[session_id]
                session.touch()
                return session, False

            # Create new session
            new_id = session_id or self.create_session_id()
            session = Session(id=new_id, data=dict(initial_data) if initial_data else {})
            self._sessions[new_id] = session
            return session, True

    async def get_session(self, session_id: str) -> Session | None:
        """Get an existing session by ID.

        Args:
            session_id: The session ID

        Returns:
            The session, or None if not found
        """
        async with self._lock:
            session = self._sessions.get(session_id)
            if session:
                session.touch()
            return session

    async def remove_session(self, session_id: str) -> None:
        """Remove a session.

        Args:
            session_id: The session ID to remove
        """
        async with self._lock:
            self._sessions.pop(session_id, None)

    async def cleanup_inactive_sessions(self) -> int:
        """Remove sessions that have been inactive for too long.

        Returns:
            Number of sessions removed
        """
        now = time.time()
        to_remove = []

        async with self._lock:
            for session_id, session in self._sessions.items():
                if now - session.last_activity > self._session_timeout:
                    to_remove.append(session_id)

            for session_id in to_remove:
                del self._sessions[session_id]

        return len(to_remove)

    @property
    def session_count(self) -> int:
        """Get the number of active sessions."""
        return len(self._sessions)

    async def broadcast_event(self, event_type: str, payload: dict[str, Any] | None = None) -> None:
        """Broadcast an event to all sessions.

        Args:
            event_type: Type of event
            payload: Event data dictionary
        """
        async with self._lock:
            sessions = list(self._sessions.values())

        for session in sessions:
            await session.push_event(event_type, payload)

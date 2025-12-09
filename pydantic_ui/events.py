"""Event queue and SSE management for real-time UI updates."""

import asyncio
import contextlib
import time
from collections import deque
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from typing import Any


@dataclass
class EventQueue:
    """Thread-safe event queue for Server-Sent Events (SSE).

    This class manages a queue of events that can be pushed to subscribers
    in real-time. It supports multiple concurrent subscribers and provides
    a polling fallback for environments that don't support SSE.

    Example:
        queue = EventQueue()

        # Push an event
        await queue.push("toast", {"message": "Hello!", "type": "info"})

        # Subscribe to events (SSE)
        async for event in queue.subscribe():
            print(f"Event: {event}")

        # Polling fallback
        events = await queue.get_pending(since=last_timestamp)
    """

    events: deque = field(default_factory=lambda: deque(maxlen=100))  # type: ignore
    subscribers: list[asyncio.Queue] = field(default_factory=list)  # type: ignore
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def push(self, event_type: str, payload: dict[str, Any] | None = None) -> None:
        """Push an event to all subscribers.

        Args:
            event_type: Type of event (e.g., 'toast', 'validation_errors')
            payload: Event data dictionary
        """
        event = {"type": event_type, "payload": payload or {}, "timestamp": time.time()}
        async with self._lock:
            self.events.append(event)
            for queue in self.subscribers:
                # Skip if queue is full (subscriber is slow)
                with contextlib.suppress(asyncio.QueueFull):
                    queue.put_nowait(event)
                    pass

    async def subscribe(self) -> AsyncGenerator[dict[str, Any], None]:
        """Subscribe to events via SSE.

        Yields:
            Event dictionaries as they are pushed.
        """
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=50)
        async with self._lock:
            self.subscribers.append(queue)
        try:
            while True:
                event = await queue.get()
                yield event
        finally:
            async with self._lock:
                if queue in self.subscribers:
                    self.subscribers.remove(queue)

    async def get_pending(self, since: float = 0) -> list[dict[str, Any]]:
        """Get events since a timestamp (for polling fallback).

        Args:
            since: Unix timestamp. Only events after this time are returned.

        Returns:
            List of event dictionaries.
        """
        async with self._lock:
            return [e for e in self.events if e["timestamp"] > since]

    async def clear(self) -> None:
        """Clear all pending events."""
        async with self._lock:
            self.events.clear()

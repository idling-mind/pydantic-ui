"""Tests for pydantic_ui/events.py - EventQueue class."""

from __future__ import annotations

import asyncio
import time

import pytest

from pydantic_ui.events import EventQueue


class TestEventQueue:
    """Tests for EventQueue class."""

    @pytest.fixture
    def queue(self) -> EventQueue:
        """Create an EventQueue for tests."""
        return EventQueue()

    @pytest.mark.asyncio
    async def test_queue_creation(self):
        """Test EventQueue creation."""
        queue = EventQueue()
        assert len(queue.events) == 0
        assert len(queue.subscribers) == 0

    @pytest.mark.asyncio
    async def test_push_event(self, queue: EventQueue):
        """Test pushing an event."""
        await queue.push("test_event", {"key": "value"})

        assert len(queue.events) == 1
        event = queue.events[0]
        assert event["type"] == "test_event"
        assert event["payload"] == {"key": "value"}
        assert "timestamp" in event

    @pytest.mark.asyncio
    async def test_push_event_no_payload(self, queue: EventQueue):
        """Test pushing event without payload."""
        await queue.push("simple_event")

        event = queue.events[0]
        assert event["type"] == "simple_event"
        assert event["payload"] == {}

    @pytest.mark.asyncio
    async def test_push_event_to_subscribers(self, queue: EventQueue):
        """Test events are delivered to subscribers."""
        received = []

        async def subscriber():
            async for event in queue.subscribe():
                received.append(event)
                if len(received) >= 2:
                    break

        task = asyncio.create_task(subscriber())
        await asyncio.sleep(0.01)

        await queue.push("event1", {"n": 1})
        await queue.push("event2", {"n": 2})

        await asyncio.wait_for(task, timeout=1.0)

        assert len(received) == 2
        assert received[0]["type"] == "event1"
        assert received[1]["type"] == "event2"

    @pytest.mark.asyncio
    async def test_multiple_subscribers(self, queue: EventQueue):
        """Test multiple subscribers receive events."""
        received1 = []
        received2 = []

        async def sub1():
            async for event in queue.subscribe():
                received1.append(event)
                if len(received1) >= 1:
                    break

        async def sub2():
            async for event in queue.subscribe():
                received2.append(event)
                if len(received2) >= 1:
                    break

        task1 = asyncio.create_task(sub1())
        task2 = asyncio.create_task(sub2())
        await asyncio.sleep(0.01)

        await queue.push("shared_event", {"shared": True})

        await asyncio.wait_for(asyncio.gather(task1, task2), timeout=1.0)

        assert len(received1) == 1
        assert len(received2) == 1
        assert received1[0]["payload"] == received2[0]["payload"]

    @pytest.mark.asyncio
    async def test_subscriber_cleanup(self, queue: EventQueue):
        """Test subscribers are cleaned up when generator exits."""
        async def short_subscriber():
            async for event in queue.subscribe():
                return event

        task = asyncio.create_task(short_subscriber())
        await asyncio.sleep(0.01)

        # Should have one subscriber
        assert len(queue.subscribers) == 1

        await queue.push("trigger", {})
        await asyncio.wait_for(task, timeout=1.0)

        # Wait for cleanup
        await asyncio.sleep(0.01)

        # Subscriber should be removed
        assert len(queue.subscribers) == 0

    @pytest.mark.asyncio
    async def test_get_pending_events(self, queue: EventQueue):
        """Test getting pending events since timestamp."""
        # Push first event
        await queue.push("old_event", {})
        await asyncio.sleep(0.01)
        mid_time = time.time()
        await asyncio.sleep(0.01)
        # Push second event
        await queue.push("new_event", {})

        # Get events since mid_time
        events = await queue.get_pending(mid_time)

        assert len(events) == 1
        assert events[0]["type"] == "new_event"

    @pytest.mark.asyncio
    async def test_get_pending_all(self, queue: EventQueue):
        """Test getting all pending events."""
        await queue.push("event1", {})
        await queue.push("event2", {})
        await queue.push("event3", {})

        events = await queue.get_pending(0)

        assert len(events) == 3

    @pytest.mark.asyncio
    async def test_clear(self, queue: EventQueue):
        """Test clearing all events."""
        await queue.push("event1", {})
        await queue.push("event2", {})

        await queue.clear()

        assert len(queue.events) == 0

    @pytest.mark.asyncio
    async def test_max_events(self):
        """Test event queue respects max size."""
        queue = EventQueue()
        # Default maxlen is 100

        for i in range(150):
            await queue.push(f"event{i}", {"index": i})

        assert len(queue.events) == 100
        # Oldest events should be dropped
        assert queue.events[0]["type"] == "event50"

    @pytest.mark.asyncio
    async def test_slow_subscriber_handled(self, queue: EventQueue):
        """Test slow subscribers don't block fast ones."""
        fast_received = []
        slow_started = asyncio.Event()

        async def fast_subscriber():
            async for event in queue.subscribe():
                fast_received.append(event)
                if len(fast_received) >= 3:
                    break

        async def slow_subscriber():
            slow_started.set()
            async for event in queue.subscribe():
                await asyncio.sleep(0.1)  # Slow processing
                break

        fast_task = asyncio.create_task(fast_subscriber())
        slow_task = asyncio.create_task(slow_subscriber())
        await slow_started.wait()
        await asyncio.sleep(0.01)

        # Push events rapidly
        await queue.push("event1", {})
        await queue.push("event2", {})
        await queue.push("event3", {})

        # Fast subscriber should complete quickly
        await asyncio.wait_for(fast_task, timeout=1.0)
        assert len(fast_received) == 3

        # Cancel slow subscriber
        slow_task.cancel()
        try:
            await slow_task
        except asyncio.CancelledError:
            pass

    @pytest.mark.asyncio
    async def test_concurrent_push(self, queue: EventQueue):
        """Test concurrent event pushing."""
        async def pusher(prefix: str, count: int):
            for i in range(count):
                await queue.push(f"{prefix}_{i}", {})

        await asyncio.gather(
            pusher("a", 10),
            pusher("b", 10),
            pusher("c", 10),
        )

        assert len(queue.events) == 30

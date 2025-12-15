"""Controller class providing convenience methods for UI interaction."""

import asyncio
import uuid
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel

from pydantic_ui.sessions import Session, SessionManager, current_session

if TYPE_CHECKING:
    from pydantic_ui.handlers import DataHandler


class PydanticUIController:
    """Controller for interacting with the Pydantic UI from Python.

    This class provides convenience methods for:
    - Showing/clearing validation errors
    - Pushing data updates to the UI
    - Showing toast notifications
    - Requesting user confirmation

    When used with session support, the controller operates on a specific session.
    Events are only sent to that session, not to all connected browsers.

    Example:
        router = create_pydantic_ui(MyModel, ui_config=ui_config)
        controller = router.controller

        @router.action("validate")
        async def handle_validate(data: dict, controller: PydanticUIController):
            errors = my_custom_validation(data)
            if errors:
                await controller.show_validation_errors(errors)
                await controller.show_toast("Validation failed", "error")
            else:
                await controller.show_toast("All good!", "success")
    """

    def __init__(self, session_manager: SessionManager, model: type[BaseModel]):
        """Initialize the controller.

        Args:
            session_manager: The session manager for routing events
            model: The Pydantic model class
        """
        self._session_manager = session_manager
        self._model = model
        self._data_handler: DataHandler | None = None
        self._current_session: Session | None = None
        self._uploaded_file: dict[str, Any] | None = None

    @property
    def uploaded_file(self) -> dict[str, Any] | None:
        """Get the file uploaded with the current action, if any.

        Returns:
            Dict with keys: name, size, type, data (base64 string)
            or None if no file was uploaded.
        """
        return self._uploaded_file

    async def _get_session(self) -> Session:
        """Get the current session, raising an error if none is set."""
        # Try to get from context var first
        session = current_session.get()
        if session is not None:
            return session

        # Fallback to instance variable (deprecated but kept for compatibility)
        if self._current_session is not None:
            return self._current_session

        raise RuntimeError(
            "No session is set. This controller must be used within a request context "
            "or have a session explicitly set."
        )

    async def show_validation_errors(self, errors: list[dict[str, str]]) -> None:
        """Display validation errors in the UI.

        Args:
            errors: List of error dicts with 'path' and 'message' keys.
                   Path format: "users.0.name" or "users[0].name"

        Example:
            await controller.show_validation_errors([
                {"path": "users[0].age", "message": "Age must be positive"},
                {"path": "name", "message": "Name is required"}
            ])
        """
        session = await self._get_session()
        await session.push_event("validation_errors", {"errors": errors})

    async def clear_validation_errors(self) -> None:
        """Clear all validation errors from the UI."""
        session = await self._get_session()
        await session.push_event("clear_validation_errors", {})

    async def push_data(self, data: BaseModel | dict[str, Any]) -> None:
        """Push new data to the UI, replacing current values.

        Args:
            data: Either a Pydantic model instance or a dict

        Example:
            new_config = MyModel(name="Updated", ...)
            await controller.push_data(new_config)
        """
        data_dict = data.model_dump(mode="json") if isinstance(data, BaseModel) else data

        session = await self._get_session()
        # Also update the session's data
        session.data = data_dict

        await session.push_event("push_data", {"data": data_dict})

    async def show_toast(self, message: str, type: str = "info", duration: int = 5000) -> None:
        """Show a toast notification.

        Args:
            message: The message to display
            type: One of "success", "error", "warning", "info"
            duration: How long to show (ms). 0 for persistent.

        Example:
            await controller.show_toast("Data saved!", "success")
            await controller.show_toast("Connection lost", "error", duration=0)
        """
        session = await self._get_session()
        await session.push_event("toast", {"message": message, "type": type, "duration": duration})

    async def request_confirmation(
        self,
        message: str,
        title: str = "Confirm Action",
        confirm_text: str = "Confirm",
        cancel_text: str = "Cancel",
        variant: str = "default",
    ) -> bool:
        """Request confirmation from the user.

        This is an async method that waits for user response.

        Args:
            message: The confirmation message
            title: Dialog title
            confirm_text: Text for confirm button
            cancel_text: Text for cancel button
            variant: "default" or "destructive"

        Returns:
            True if confirmed, False if cancelled

        Example:
            if await controller.request_confirmation(
                "Delete all users?",
                title="Confirm Deletion",
                variant="destructive"
            ):
                # User confirmed
                delete_all_users()
        """
        session = await self._get_session()

        confirmation_id = str(uuid.uuid4())
        loop = asyncio.get_running_loop()
        future: asyncio.Future[bool] = loop.create_future()
        session.pending_confirmations[confirmation_id] = future

        await session.push_event(
            "confirmation_request",
            {
                "id": confirmation_id,
                "title": title,
                "message": message,
                "confirm_text": confirm_text,
                "cancel_text": cancel_text,
                "variant": variant,
            },
        )

        try:
            # Wait for response with timeout (5 minutes)
            result = await asyncio.wait_for(future, timeout=300)
            return result
        except asyncio.TimeoutError:
            return False
        finally:
            session.pending_confirmations.pop(confirmation_id, None)

    def resolve_confirmation(self, confirmation_id: str, confirmed: bool) -> None:
        """Resolve a pending confirmation (called by API endpoint).

        Note: This method is deprecated when using sessions.
        Use the session's pending_confirmations directly instead.

        Args:
            confirmation_id: The ID of the confirmation request
            confirmed: Whether the user confirmed or cancelled
        """
        if self._current_session:
            future = self._current_session.pending_confirmations.get(confirmation_id)
            if future and not future.done():
                future.set_result(confirmed)

    async def refresh(self) -> None:
        """Tell the UI to refresh data from the server."""
        session = await self._get_session()
        await session.push_event("refresh", {})

    def get_current_data(self) -> dict[str, Any]:
        """Get the current data from the session.

        Returns:
            The current data dictionary
        """
        if self._current_session:
            return self._current_session.data
        return {}

    def get_model_instance(self) -> BaseModel | None:
        """Get current data as a validated model instance.

        Returns:
            A validated model instance, or None if validation fails
        """
        data = self.get_current_data()
        if data:
            try:
                return self._model.model_validate(data)
            except Exception:
                return None
        return None

    async def navigate_to(self, url: str, new_tab: bool = False) -> None:
        """Navigate the UI to a new URL.

        Args:
            url: The URL to navigate to
            new_tab: Whether to open in a new tab

        Example:
            await controller.navigate_to("https://example.com")
            await controller.navigate_to("/other-page", new_tab=True)
        """
        session = await self._get_session()
        await session.push_event("navigate", {"url": url, "new_tab": new_tab})

    async def download_file(self, filename: str, data: str) -> None:
        """Trigger a file download in the browser.

        Args:
            filename: The name of the file to download
            data: The file content as a base64 data URL (e.g. "data:text/plain;base64,...")

        Example:
            await controller.download_file("report.pdf", "data:application/pdf;base64,JVBERi0xL...")
        """
        session = await self._get_session()
        await session.push_event("download_file", {"filename": filename, "data": data})

    async def show_progress(self, progress: int | None) -> None:
        """Show or hide the progress bar.

        Args:
            progress: Percentage (0-100) to show, or None to hide.

        Example:
            await controller.show_progress(50)
            await controller.show_progress(None)  # Hide
        """
        session = await self._get_session()
        await session.push_event("progress", {"progress": progress})

    async def hide_progress(self) -> None:
        """Hide the progress bar.

        Example:
            await controller.hide_progress()
        """
        await self.show_progress(None)

    async def broadcast_toast(self, message: str, type: str = "info", duration: int = 5000) -> None:
        """Broadcast a toast notification to all sessions.

        Unlike show_toast, this sends to ALL connected browsers.

        Args:
            message: The message to display
            type: One of "success", "error", "warning", "info"
            duration: How long to show (ms). 0 for persistent.
        """
        await self._session_manager.broadcast_event(
            "toast", {"message": message, "type": type, "duration": duration}
        )

    async def broadcast_refresh(self) -> None:
        """Tell all connected UIs to refresh data from the server."""
        await self._session_manager.broadcast_event("refresh", {})

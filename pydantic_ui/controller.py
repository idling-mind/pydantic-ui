"""Controller class providing convenience methods for UI interaction."""

import asyncio
import uuid
from typing import Any, TYPE_CHECKING

from pydantic import BaseModel

from pydantic_ui.events import EventQueue

if TYPE_CHECKING:
    from pydantic_ui.handlers import DataHandler


class PydanticUIController:
    """Controller for interacting with the Pydantic UI from Python.
    
    This class provides convenience methods for:
    - Showing/clearing validation errors
    - Pushing data updates to the UI
    - Showing toast notifications
    - Requesting user confirmation
    
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
    
    def __init__(self, event_queue: EventQueue, model: type[BaseModel]):
        """Initialize the controller.
        
        Args:
            event_queue: The event queue for pushing events
            model: The Pydantic model class
        """
        self._event_queue = event_queue
        self._model = model
        self._pending_confirmations: dict[str, asyncio.Future[bool]] = {}
        self._data_handler: "DataHandler | None" = None
    
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
        await self._event_queue.push("validation_errors", {"errors": errors})
    
    async def clear_validation_errors(self) -> None:
        """Clear all validation errors from the UI."""
        await self._event_queue.push("clear_validation_errors", {})
    
    async def push_data(self, data: BaseModel | dict[str, Any]) -> None:
        """Push new data to the UI, replacing current values.
        
        Args:
            data: Either a Pydantic model instance or a dict
        
        Example:
            new_config = MyModel(name="Updated", ...)
            await controller.push_data(new_config)
        """
        if isinstance(data, BaseModel):
            data_dict = data.model_dump(mode="json")
        else:
            data_dict = data
        
        # Also update the handler's internal data
        if self._data_handler:
            self._data_handler._data = data_dict
        
        await self._event_queue.push("push_data", {"data": data_dict})
    
    async def show_toast(
        self, 
        message: str, 
        type: str = "info",
        duration: int = 5000
    ) -> None:
        """Show a toast notification.
        
        Args:
            message: The message to display
            type: One of "success", "error", "warning", "info"
            duration: How long to show (ms). 0 for persistent.
        
        Example:
            await controller.show_toast("Data saved!", "success")
            await controller.show_toast("Connection lost", "error", duration=0)
        """
        await self._event_queue.push("toast", {
            "message": message,
            "type": type,
            "duration": duration
        })
    
    async def request_confirmation(
        self,
        message: str,
        title: str = "Confirm Action",
        confirm_text: str = "Confirm",
        cancel_text: str = "Cancel",
        variant: str = "default"
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
        confirmation_id = str(uuid.uuid4())
        loop = asyncio.get_running_loop()
        future: asyncio.Future[bool] = loop.create_future()
        self._pending_confirmations[confirmation_id] = future
        
        await self._event_queue.push("confirmation_request", {
            "id": confirmation_id,
            "title": title,
            "message": message,
            "confirm_text": confirm_text,
            "cancel_text": cancel_text,
            "variant": variant
        })
        
        try:
            # Wait for response with timeout (5 minutes)
            result = await asyncio.wait_for(future, timeout=300)
            return result
        except asyncio.TimeoutError:
            return False
        finally:
            self._pending_confirmations.pop(confirmation_id, None)
    
    def resolve_confirmation(self, confirmation_id: str, confirmed: bool) -> None:
        """Resolve a pending confirmation (called by API endpoint).
        
        Args:
            confirmation_id: The ID of the confirmation request
            confirmed: Whether the user confirmed or cancelled
        """
        future = self._pending_confirmations.get(confirmation_id)
        if future and not future.done():
            future.set_result(confirmed)
    
    async def refresh(self) -> None:
        """Tell the UI to refresh data from the server."""
        await self._event_queue.push("refresh", {})
    
    def get_current_data(self) -> dict[str, Any]:
        """Get the current data from the handler.
        
        Returns:
            The current data dictionary
        """
        if self._data_handler:
            return self._data_handler._data
        return {}
    
    def get_model_instance(self) -> BaseModel | None:
        """Get current data as a validated model instance.
        
        Returns:
            A validated model instance, or None if validation fails
        """
        if self._data_handler:
            try:
                return self._model.model_validate(self._data_handler._data)
            except Exception:
                return None
        return None

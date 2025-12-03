# Detailed Implementation Plan: Custom Buttons, Validation Errors & Convenience Functions

## Overview

This plan adds the following capabilities to pydantic-ui:

1. **Custom Action Buttons** - User-defined buttons at the bottom with custom callbacks
2. **Programmatic Validation Errors** - Show/clear validation errors in the UI from Python
3. **Confirmation Dialogs** - Get user confirmation before actions
4. **Push Data Updates** - Update the UI data from Python (e.g., after a backend operation)
5. **Toast Notifications** - Show success/error/info messages

## Architecture Design

### Communication Pattern

The key challenge is **bidirectional communication** between Python backend and React frontend:

```
┌─────────────────────────────────────────────────────────────┐
│                      Python Backend                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ PydanticUI Instance (convenience methods)             │  │
│  │  - show_validation_errors(errors)                     │  │
│  │  - clear_validation_errors()                          │  │
│  │  - push_data(new_data)                                │  │
│  │  - show_toast(message, type)                          │  │
│  │  - request_confirmation(message) → awaitable          │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                    Server-Sent Events (SSE)                  │
│                    + REST API endpoints                      │
│                           ↓                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ EventContext (SSE listener)                            │  │
│  │  - listens for: validation_errors, data_push,         │  │
│  │    toast, confirmation_request                         │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Custom Action Buttons                                  │  │
│  │  - Rendered from config.actions[]                      │  │
│  │  - POST /api/actions/{action_id} on click             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Option A: Polling-based (Simpler, works everywhere)
- Frontend polls `/api/events` every 500ms
- Backend queues events in memory
- Simple but adds latency

### Option B: Server-Sent Events (SSE) - **Recommended**
- Real-time push from backend to frontend
- Native browser support, no websocket complexity
- Falls back gracefully

I'll implement **Option B (SSE)** as the primary mechanism with polling fallback.

---

## Implementation Details

### Phase 1: Backend Infrastructure

#### 1.1 New Models (models.py)

```python
# New models to add:

class ActionButton(BaseModel):
    """Configuration for a custom action button."""
    id: str
    label: str
    variant: Literal["default", "secondary", "outline", "ghost", "destructive"] = "default"
    icon: str | None = None  # Lucide icon name
    disabled: bool = False
    tooltip: str | None = None
    confirm: str | None = None  # If set, show confirmation dialog first

class UIEvent(BaseModel):
    """Event sent from backend to frontend."""
    type: Literal[
        "validation_errors",
        "clear_validation_errors", 
        "push_data",
        "toast",
        "confirmation_request",
        "confirmation_response",
        "refresh"
    ]
    payload: dict[str, Any] = {}
    timestamp: float = Field(default_factory=lambda: time.time())

class ToastMessage(BaseModel):
    """Toast notification configuration."""
    message: str
    type: Literal["success", "error", "warning", "info"] = "info"
    duration: int = 5000  # ms, 0 for persistent

class ConfirmationRequest(BaseModel):
    """Confirmation dialog request."""
    id: str
    title: str
    message: str
    confirm_text: str = "Confirm"
    cancel_text: str = "Cancel"
    variant: Literal["default", "destructive"] = "default"

class ActionRequest(BaseModel):
    """Request body when an action button is clicked."""
    action_id: str
    current_data: dict[str, Any]
```

#### 1.2 Event Queue Manager (`pydantic_ui/events.py`) - **New File**

```python
"""Event queue and SSE management for real-time UI updates."""

import asyncio
import time
from typing import Any, AsyncGenerator
from collections import deque
from dataclasses import dataclass, field
import json

@dataclass
class EventQueue:
    """Thread-safe event queue for SSE."""
    events: deque = field(default_factory=lambda: deque(maxlen=100))
    subscribers: list[asyncio.Queue] = field(default_factory=list)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    
    async def push(self, event_type: str, payload: dict[str, Any] = None):
        """Push an event to all subscribers."""
        event = {
            "type": event_type,
            "payload": payload or {},
            "timestamp": time.time()
        }
        async with self._lock:
            self.events.append(event)
            for queue in self.subscribers:
                await queue.put(event)
    
    async def subscribe(self) -> AsyncGenerator[dict, None]:
        """Subscribe to events."""
        queue = asyncio.Queue()
        async with self._lock:
            self.subscribers.append(queue)
        try:
            while True:
                event = await queue.get()
                yield event
        finally:
            async with self._lock:
                self.subscribers.remove(queue)
    
    async def get_pending(self, since: float = 0) -> list[dict]:
        """Get events since timestamp (for polling fallback)."""
        async with self._lock:
            return [e for e in self.events if e["timestamp"] > since]
```

#### 1.3 Enhanced UIConfig (config.py)

```python
# Add to UIConfig class:

class UIConfig(BaseModel):
    # ... existing fields ...
    
    # New: Custom action buttons
    actions: list[ActionButton] = Field(
        default_factory=list,
        description="Custom action buttons shown in the footer"
    )
```

#### 1.4 PydanticUIController Class (`pydantic_ui/controller.py`) - **New File**

This is the main convenience API for users:

```python
"""Controller class providing convenience methods for UI interaction."""

import asyncio
import uuid
from typing import Any, Callable, Awaitable
from pydantic import BaseModel

from pydantic_ui.events import EventQueue
from pydantic_ui.models import ToastMessage, ConfirmationRequest, ValidationError

class PydanticUIController:
    """Controller for interacting with the Pydantic UI from Python.
    
    This class provides convenience methods for:
    - Showing/clearing validation errors
    - Pushing data updates to the UI
    - Showing toast notifications
    - Requesting user confirmation
    
    Example:
        controller = pydantic_ui_router.controller
        
        @pydantic_ui_router.action("validate")
        async def handle_validate(data: dict):
            errors = my_custom_validation(data)
            if errors:
                await controller.show_validation_errors(errors)
                await controller.show_toast("Validation failed", "error")
            else:
                await controller.show_toast("All good!", "success")
    """
    
    def __init__(self, event_queue: EventQueue, model: type[BaseModel]):
        self._event_queue = event_queue
        self._model = model
        self._pending_confirmations: dict[str, asyncio.Future] = {}
        self._data_handler = None  # Set by app.py
    
    async def show_validation_errors(self, errors: list[dict[str, str]]):
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
    
    async def clear_validation_errors(self):
        """Clear all validation errors from the UI."""
        await self._event_queue.push("clear_validation_errors", {})
    
    async def push_data(self, data: BaseModel | dict[str, Any]):
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
    ):
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
        future = asyncio.get_event_loop().create_future()
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
            # Wait for response with timeout
            result = await asyncio.wait_for(future, timeout=300)  # 5 min timeout
            return result
        except asyncio.TimeoutError:
            return False
        finally:
            self._pending_confirmations.pop(confirmation_id, None)
    
    def resolve_confirmation(self, confirmation_id: str, confirmed: bool):
        """Resolve a pending confirmation (called by API endpoint)."""
        future = self._pending_confirmations.get(confirmation_id)
        if future and not future.done():
            future.set_result(confirmed)
    
    async def refresh(self):
        """Tell the UI to refresh data from the server."""
        await self._event_queue.push("refresh", {})
    
    def get_current_data(self) -> dict[str, Any]:
        """Get the current data from the handler."""
        if self._data_handler:
            return self._data_handler._data
        return {}
    
    def get_model_instance(self) -> BaseModel | None:
        """Get current data as a validated model instance."""
        if self._data_handler:
            try:
                return self._model.model_validate(self._data_handler._data)
            except Exception:
                return None
        return None
```

#### 1.5 Updated `create_pydantic_ui` Function (app.py)

```python
def create_pydantic_ui(
    model: type[BaseModel],
    *,
    ui_config: UIConfig | None = None,
    field_configs: dict[str, FieldConfig] | None = None,
    initial_data: BaseModel | None = None,
    data_loader: Callable[[], BaseModel | dict[str, Any]] | None = None,
    data_saver: Callable[[BaseModel], None] | None = None,
    prefix: str = "",
) -> APIRouter:
    # ... existing setup ...
    
    # Create event queue and controller
    event_queue = EventQueue()
    controller = PydanticUIController(event_queue, model)
    controller._data_handler = handler
    
    # Store controller on router for access
    router.controller = controller
    
    # New endpoints:
    
    @router.get("/api/events")
    async def sse_events():
        """Server-Sent Events endpoint for real-time updates."""
        async def event_generator():
            async for event in event_queue.subscribe():
                yield f"data: {json.dumps(event)}\n\n"
        
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
    
    @router.get("/api/events/poll")
    async def poll_events(since: float = 0):
        """Polling fallback for environments that don't support SSE."""
        events = await event_queue.get_pending(since)
        return JSONResponse(content={"events": events})
    
    @router.post("/api/actions/{action_id}")
    async def handle_action(action_id: str, request: Request):
        """Handle custom action button clicks."""
        body = await request.json()
        current_data = body.get("data", {})
        
        # Find registered handler
        handler_func = action_handlers.get(action_id)
        if handler_func:
            try:
                result = handler_func(current_data, controller)
                if asyncio.iscoroutine(result):
                    result = await result
                return JSONResponse(content={"success": True, "result": result})
            except Exception as e:
                return JSONResponse(
                    content={"success": False, "error": str(e)},
                    status_code=400
                )
        return JSONResponse(
            content={"success": False, "error": "Unknown action"},
            status_code=404
        )
    
    @router.post("/api/confirmation/{confirmation_id}")
    async def handle_confirmation(confirmation_id: str, request: Request):
        """Handle confirmation dialog responses."""
        body = await request.json()
        confirmed = body.get("confirmed", False)
        controller.resolve_confirmation(confirmation_id, confirmed)
        return JSONResponse(content={"ok": True})
    
    # Action handler registration decorator
    action_handlers: dict[str, Callable] = {}
    
    def action(action_id: str):
        """Decorator to register an action handler.
        
        Example:
            @pydantic_ui_router.action("run_validation")
            async def run_validation(data: dict, controller: PydanticUIController):
                errors = validate(data)
                if errors:
                    await controller.show_validation_errors(errors)
                    return {"valid": False}
                return {"valid": True}
        """
        def decorator(func):
            action_handlers[action_id] = func
            return func
        return decorator
    
    router.action = action
    
    return router
```

#### 1.6 Updated Config Response

Update `ConfigResponse` in models.py to include actions:

```python
class ConfigResponse(BaseModel):
    # ... existing fields ...
    actions: list[ActionButton] = Field(default_factory=list)
```

---

### Phase 2: Frontend Infrastructure

#### 2.1 New Types (types.ts)

```typescript
// Add to types.ts:

export interface ActionButton {
  id: string;
  label: string;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  icon?: string;
  disabled?: boolean;
  tooltip?: string;
  confirm?: string;  // If set, show confirmation before triggering
}

export interface UIEvent {
  type: 
    | 'validation_errors'
    | 'clear_validation_errors'
    | 'push_data'
    | 'toast'
    | 'confirmation_request'
    | 'refresh';
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
}

export interface ConfirmationRequest {
  id: string;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: 'default' | 'destructive';
}

// Update UIConfig
export interface UIConfig {
  // ... existing fields ...
  actions: ActionButton[];
}
```

#### 2.2 Event Context (`frontend/src/context/EventContext.tsx`) - **New File**

```tsx
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { UIEvent, ToastMessage, ConfirmationRequest } from '@/types';
import { useData } from './DataContext';

interface EventContextValue {
  toasts: ToastMessage[];
  confirmationRequest: ConfirmationRequest | null;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  respondToConfirmation: (confirmed: boolean) => void;
}

const EventContext = createContext<EventContextValue | null>(null);

export function EventProvider({ children, apiBase = '/api' }: { children: React.ReactNode; apiBase?: string }) {
  const { setExternalErrors, clearErrors, setData, refresh } = useData();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmationRequest, setConfirmationRequest] = useState<ConfirmationRequest | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Handle incoming events
  const handleEvent = useCallback((event: UIEvent) => {
    switch (event.type) {
      case 'validation_errors':
        setExternalErrors(event.payload.errors as FieldError[]);
        break;
      case 'clear_validation_errors':
        clearErrors();
        break;
      case 'push_data':
        setData(event.payload.data as Record<string, unknown>);
        break;
      case 'toast':
        addToast({
          message: event.payload.message as string,
          type: event.payload.type as ToastMessage['type'],
          duration: event.payload.duration as number,
        });
        break;
      case 'confirmation_request':
        setConfirmationRequest({
          id: event.payload.id as string,
          title: event.payload.title as string,
          message: event.payload.message as string,
          confirmText: event.payload.confirm_text as string,
          cancelText: event.payload.cancel_text as string,
          variant: event.payload.variant as 'default' | 'destructive',
        });
        break;
      case 'refresh':
        refresh();
        break;
    }
  }, [setExternalErrors, clearErrors, setData, refresh]);

  // SSE connection
  useEffect(() => {
    const baseUrl = apiBase.startsWith('http') ? apiBase : `${window.location.origin}${apiBase}`;
    const eventSource = new EventSource(`${baseUrl}/events`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as UIEvent;
        handleEvent(data);
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    };

    eventSource.onerror = () => {
      // Fall back to polling if SSE fails
      eventSource.close();
      startPolling();
    };

    return () => {
      eventSource.close();
    };
  }, [apiBase, handleEvent]);

  // Polling fallback
  const startPolling = useCallback(() => {
    let lastTimestamp = 0;
    const poll = async () => {
      try {
        const response = await fetch(`${apiBase}/events/poll?since=${lastTimestamp}`);
        const data = await response.json();
        for (const event of data.events) {
          handleEvent(event);
          lastTimestamp = Math.max(lastTimestamp, event.timestamp);
        }
      } catch (e) {
        console.error('Polling failed:', e);
      }
      setTimeout(poll, 1000);
    };
    poll();
  }, [apiBase, handleEvent]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);
    
    if (toast.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, toast.duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const respondToConfirmation = useCallback(async (confirmed: boolean) => {
    if (!confirmationRequest) return;
    
    try {
      await fetch(`${apiBase}/confirmation/${confirmationRequest.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed }),
      });
    } finally {
      setConfirmationRequest(null);
    }
  }, [apiBase, confirmationRequest]);

  return (
    <EventContext.Provider value={{
      toasts,
      confirmationRequest,
      addToast,
      removeToast,
      respondToConfirmation,
    }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvents() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvents must be used within EventProvider');
  }
  return context;
}
```

#### 2.3 Updated DataContext

Add methods to DataContext for external error/data management:

```typescript
// Add to DataContextValue interface:
setExternalErrors: (errors: FieldError[]) => void;
clearErrors: () => void;
setData: (data: Record<string, unknown>) => void;

// Add implementations in DataProvider
```

#### 2.4 Toast Component (`frontend/src/components/ui/toast.tsx`)

Install shadcn/ui toast or create a simple one:

```tsx
// Use shadcn/ui toast component
// npx shadcn-ui@latest add toast
```

#### 2.5 Confirmation Dialog Component

```tsx
// frontend/src/components/ConfirmationDialog/index.tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useEvents } from '@/context/EventContext';

export function ConfirmationDialog() {
  const { confirmationRequest, respondToConfirmation } = useEvents();
  
  if (!confirmationRequest) return null;
  
  return (
    <AlertDialog open={true} onOpenChange={(open) => !open && respondToConfirmation(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmationRequest.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirmationRequest.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => respondToConfirmation(false)}>
            {confirmationRequest.cancelText}
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => respondToConfirmation(true)}
            className={confirmationRequest.variant === 'destructive' ? 'bg-destructive' : ''}
          >
            {confirmationRequest.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

#### 2.6 Action Buttons Footer Component

```tsx
// frontend/src/components/ActionButtons/index.tsx
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useData } from '@/context/DataContext';
import type { ActionButton } from '@/types';

interface ActionButtonsProps {
  actions: ActionButton[];
  apiBase?: string;
}

export function ActionButtons({ actions, apiBase = '/api' }: ActionButtonsProps) {
  const { data } = useData();
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: ActionButton) => {
    // Handle confirmation if needed
    if (action.confirm) {
      // Show browser confirm or use our dialog
      if (!window.confirm(action.confirm)) return;
    }

    setLoading(action.id);
    try {
      const response = await fetch(`${apiBase}/actions/${action.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      const result = await response.json();
      if (!result.success) {
        console.error('Action failed:', result.error);
      }
    } catch (e) {
      console.error('Action error:', e);
    } finally {
      setLoading(null);
    }
  };

  if (!actions?.length) return null;

  return (
    <div className="flex items-center gap-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={action.variant || 'default'}
          onClick={() => handleAction(action)}
          disabled={action.disabled || loading === action.id}
        >
          {loading === action.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {action.label}
        </Button>
      ))}
    </div>
  );
}
```

#### 2.7 Update DetailPanel Footer

Modify the footer in index.tsx to include custom action buttons:

```tsx
{/* Footer Actions */}
<div className="p-4 flex items-center justify-between bg-muted/30">
  <div className="flex items-center gap-2">
    {/* Existing Reset button */}
    {/* Custom action buttons from config */}
    {config?.actions && <ActionButtons actions={config.actions} />}
  </div>
  {/* Existing Save button */}
</div>
```

#### 2.8 Toast Container Component

```tsx
// frontend/src/components/ToastContainer/index.tsx
import { useEvents } from '@/context/EventContext';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export function ToastContainer() {
  const { toasts, removeToast } = useEvents();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-3 bg-background border rounded-lg p-4 shadow-lg max-w-sm"
        >
          {getIcon(toast.type)}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => removeToast(toast.id)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

### Phase 3: Updated Public API

#### 3.1 Update __init__.py

```python
from pydantic_ui.config import FieldConfig, Renderer, UIConfig, ActionButton
from pydantic_ui.app import create_pydantic_ui
from pydantic_ui.controller import PydanticUIController

__all__ = [
    "create_pydantic_ui",
    "UIConfig",
    "FieldConfig",
    "Renderer",
    "ActionButton",
    "PydanticUIController",
]
```

---

## Usage Examples

### Example 1: Custom Validation with Error Display

```python
from pydantic_ui import create_pydantic_ui, UIConfig, ActionButton

ui_config = UIConfig(
    title="Config Editor",
    actions=[
        ActionButton(id="validate", label="Validate All", variant="secondary"),
        ActionButton(id="deploy", label="Deploy", variant="default"),
    ]
)

router = create_pydantic_ui(MyModel, ui_config=ui_config, prefix="/config")
app.include_router(router)

@router.action("validate")
async def handle_validate(data: dict, controller):
    errors = my_custom_validation(data)
    if errors:
        await controller.show_validation_errors([
            {"path": e.field, "message": e.message}
            for e in errors
        ])
        await controller.show_toast("Validation failed", "error")
    else:
        await controller.clear_validation_errors()
        await controller.show_toast("All validations passed!", "success")

@router.action("deploy")
async def handle_deploy(data: dict, controller):
    if await controller.request_confirmation(
        "Deploy this configuration to production?",
        title="Confirm Deployment",
        variant="destructive"
    ):
        # Do deployment
        await deploy_config(data)
        await controller.show_toast("Deployed successfully!", "success")
```

### Example 2: Push Updated Data

```python
@router.action("load_template")
async def load_template(data: dict, controller):
    template = load_default_template()
    await controller.push_data(template)
    await controller.show_toast("Template loaded", "info")
```

### Example 3: Background Task with Status Updates

```python
@router.action("process")
async def process_data(data: dict, controller):
    await controller.show_toast("Processing started...", "info", duration=0)
    
    try:
        result = await long_running_process(data)
        await controller.push_data(result)
        await controller.show_toast("Processing complete!", "success")
    except Exception as e:
        await controller.show_validation_errors([
            {"path": "", "message": f"Processing failed: {e}"}
        ])
        await controller.show_toast(str(e), "error")
```

---

## File Changes Summary

### New Files
| File | Description |
|------|-------------|
| `pydantic_ui/events.py` | Event queue for SSE |
| `pydantic_ui/controller.py` | PydanticUIController convenience class |
| `frontend/src/context/EventContext.tsx` | SSE/polling event handling |
| index.tsx | Toast notifications |
| index.tsx | Confirmation dialogs |
| index.tsx | Custom action buttons |

### Modified Files
| File | Changes |
|------|---------|
| __init__.py | Export ActionButton, PydanticUIController |
| config.py | Add ActionButton model, actions to UIConfig |
| models.py | Add event models, update ConfigResponse |
| app.py | Add SSE endpoint, action handlers, controller |
| types.ts | Add new types |
| DataContext.tsx | Add external error/data methods |
| index.tsx | Add ToastContainer, ConfirmationDialog |
| index.tsx | Add ActionButtons to footer |
| App.tsx | Wrap with EventProvider |
| api.ts | Add action API methods |

---

## Implementation Order

1. **Phase 1A**: Backend models and events (1-2 hours)
2. **Phase 1B**: PydanticUIController class (1-2 hours)
3. **Phase 1C**: Updated app.py with new endpoints (1-2 hours)
4. **Phase 2A**: Frontend types and EventContext (1-2 hours)
5. **Phase 2B**: Toast and Confirmation components (1 hour)
6. **Phase 2C**: ActionButtons component (1 hour)
7. **Phase 2D**: Integration into Layout/DetailPanel (1 hour)
8. **Phase 3**: Testing and documentation (1-2 hours)

**Total estimated time: 8-14 hours**

---

Would you like me to proceed with implementing this plan? I can start with any phase you prefer, or implement the entire solution.
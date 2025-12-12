"""FastAPI router factory for Pydantic UI."""

import asyncio
import json
from collections.abc import AsyncGenerator, Callable
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel

from pydantic_ui.config import FieldConfig, UIConfig
from pydantic_ui.controller import PydanticUIController
from pydantic_ui.handlers import DataHandler
from pydantic_ui.schema import model_to_data
from pydantic_ui.sessions import Session, SessionManager, current_session


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
    """Create a FastAPI router for editing a Pydantic model.

    Args:
        model: The Pydantic model class to create a UI for
        ui_config: Global UI configuration options
        field_configs: Per-field UI configurations (keyed by field path)
        initial_data: Initial data to populate the form
        data_loader: Async function to load data
        data_saver: Async function to save data
        prefix: URL prefix for the router

    Returns:
        FastAPI APIRouter with all necessary endpoints and a controller attribute.

    The returned router has additional attributes:
        - controller: PydanticUIController for interacting with the UI
        - action: Decorator for registering action handlers
        - data_loader: Decorator for setting a custom data loader
        - data_saver: Decorator for setting a custom data saver

    Example:
        from fastapi import FastAPI
        from pydantic import BaseModel
        from pydantic_ui import create_pydantic_ui, UIConfig, ActionButton

        class Person(BaseModel):
            name: str
            age: int

        ui_config = UIConfig(
            title="Person Editor",
            actions=[
                ActionButton(id="validate", label="Validate", variant="secondary"),
            ]
        )

        app = FastAPI()
        router = create_pydantic_ui(Person, ui_config=ui_config, prefix="/editor")
        app.include_router(router)

        @router.action("validate")
        async def validate_action(data: dict, controller):
            # Custom validation logic
            await controller.show_toast("Validated!", "success")
    """
    if ui_config is None:
        ui_config = UIConfig()

    router = APIRouter(prefix=prefix, tags=["pydantic-ui"])

    # Create data handler (for schema and config)
    handler = DataHandler(
        model=model,
        ui_config=ui_config,
        field_configs=field_configs,
        initial_data=initial_data,
        data_loader=data_loader,
        data_saver=data_saver,
    )

    # Create session manager for per-session state
    session_manager = SessionManager()

    # Get initial data for new sessions
    def get_initial_session_data() -> dict[str, Any]:
        if initial_data is not None:
            return initial_data.model_dump(mode="json", warnings=False)
        return model_to_data(model)

    # Helper to get or create session from request
    async def get_session_from_request(request: Request) -> Session:
        session_id = request.cookies.get("pydantic_ui_session")
        session, _ = await session_manager.get_or_create_session(
            session_id, get_initial_session_data()
        )
        return session

    # Helper to set session cookie on response
    def set_session_cookie(response: Response, session: Session) -> None:
        response.set_cookie(
            "pydantic_ui_session",
            session.id,
            httponly=True,
            samesite="lax",
            max_age=3600 * 24 * 7,  # 1 week
        )

    # Create a default controller (for backwards compatibility and action handlers)
    # The controller's session will be set per-request
    controller = PydanticUIController(session_manager, model)
    controller._data_handler = handler

    # Store handler and controller for decorator access
    router._pydantic_ui_handler = handler  # type: ignore
    router.controller = controller  # type: ignore
    router._session_manager = session_manager  # type: ignore

    # Action handler registry
    action_handlers: dict[str, Callable[..., Any]] = {}

    # Get the static files directory
    static_dir = Path(__file__).parent / "static"

    # API endpoints
    @router.get("/api/schema")
    async def get_schema() -> JSONResponse:
        """Get the model schema."""
        schema = await handler.get_schema()
        return JSONResponse(content=schema)

    @router.get("/api/data")
    async def get_data(request: Request, _response: Response) -> JSONResponse:
        """Get the current data for this session."""
        session = await get_session_from_request(request)

        # If data loader is defined, use it to get fresh data
        if data_loader is not None:
            try:
                loaded = data_loader()
                if hasattr(loaded, "__await__"):
                    loaded = await loaded
                if isinstance(loaded, BaseModel):
                    session.data = loaded.model_dump(mode="json", warnings=False)
                elif isinstance(loaded, dict):
                    session.data = loaded
            except Exception:
                pass

        resp = JSONResponse(content={"data": session.data})
        set_session_cookie(resp, session)
        return resp

    @router.post("/api/data")
    async def update_data(request: Request, _response: Response) -> JSONResponse:
        """Update the data for this session."""
        session = await get_session_from_request(request)
        body = await request.json()
        data = body.get("data", body)

        # Validate with the model
        try:
            from pydantic import ValidationError

            instance = model.model_validate(data)
            session.data = instance.model_dump(mode="json", warnings=False)

            # Call saver if provided
            if data_saver is not None:
                result = data_saver(instance)
                if hasattr(result, "__await__"):
                    await result  # type: ignore

            resp = JSONResponse(content={"data": session.data, "valid": True})
            set_session_cookie(resp, session)
            return resp
        except ValidationError as e:
            resp = JSONResponse(
                content={
                    "data": data,
                    "valid": False,
                    "errors": [
                        {
                            "path": ".".join(str(loc) for loc in err["loc"]),
                            "message": err["msg"],
                            "type": err["type"],
                        }
                        for err in e.errors()
                    ],
                }
            )
            set_session_cookie(resp, session)
            return resp

    @router.patch("/api/data")
    async def partial_update(request: Request, _response: Response) -> JSONResponse:
        """Partially update the data for this session."""
        from pydantic import ValidationError

        from pydantic_ui.utils import set_value_at_path

        session = await get_session_from_request(request)
        body = await request.json()
        path = body.get("path", "")
        value = body.get("value")

        new_data = set_value_at_path(dict(session.data), path, value)

        # Validate the entire model
        try:
            instance = model.model_validate(new_data)
            session.data = instance.model_dump(mode="json", warnings=False)

            if data_saver is not None:
                result = data_saver(instance)
                if hasattr(result, "__await__"):
                    await result  # type: ignore

            resp = JSONResponse(content={"data": session.data, "valid": True})
            set_session_cookie(resp, session)
            return resp
        except ValidationError as e:
            # Still update the data but return errors
            session.data = new_data
            resp = JSONResponse(
                content={
                    "data": session.data,
                    "valid": False,
                    "errors": [
                        {
                            "path": ".".join(str(loc) for loc in err["loc"]),
                            "message": err["msg"],
                            "type": err["type"],
                        }
                        for err in e.errors()
                    ],
                }
            )
            set_session_cookie(resp, session)
            return resp

    @router.post("/api/validate")
    async def validate_data(request: Request) -> JSONResponse:
        """Validate data without saving."""
        body = await request.json()
        data = body.get("data", body)
        result = await handler.validate_data(data)
        return JSONResponse(content=result.model_dump())

    @router.get("/api/config")
    async def get_config() -> JSONResponse:
        """Get the UI configuration."""
        config = handler.get_config()
        return JSONResponse(content=config.model_dump())

    @router.get("/api/session")
    async def get_session_info(request: Request, _response: Response) -> JSONResponse:
        """Get or create a session and return its ID."""
        session = await get_session_from_request(request)
        resp = JSONResponse(content={"session_id": session.id})
        set_session_cookie(resp, session)
        return resp

    # SSE endpoint for real-time events
    @router.get("/api/events")
    async def sse_events(request: Request) -> StreamingResponse:
        """Server-Sent Events endpoint for real-time UI updates."""
        session = await get_session_from_request(request)

        async def event_generator() -> AsyncGenerator[str, None]:
            async for event in session.subscribe():
                yield f"data: {json.dumps(event)}\n\n"

        resp = StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
            },
        )
        set_session_cookie(resp, session)
        return resp

    # Polling fallback for environments that don't support SSE
    @router.get("/api/events/poll")
    async def poll_events(request: Request, since: float = 0) -> JSONResponse:
        """Polling fallback for real-time events."""
        session = await get_session_from_request(request)
        events = await session.get_pending_events(since)
        return JSONResponse(content={"events": events})

    # Action handler endpoint
    @router.post("/api/actions/{action_id}")
    async def handle_action(action_id: str, request: Request) -> JSONResponse:
        """Handle custom action button clicks."""
        session = await get_session_from_request(request)
        body = await request.json()
        current_data = body.get("data", {})
        uploaded_file = body.get("file")

        # Set the current session context
        token = current_session.set(session)

        try:
            # Create a session-specific controller for this action
            session_controller = PydanticUIController(session_manager, model)
            session_controller._data_handler = handler
            session_controller._current_session = session
            session_controller._uploaded_file = uploaded_file

            handler_func = action_handlers.get(action_id)
            if handler_func:
                try:
                    result = handler_func(current_data, session_controller)
                    if asyncio.iscoroutine(result):
                        result = await result
                    return JSONResponse(content={"success": True, "result": result})
                except Exception as e:
                    return JSONResponse(
                        content={"success": False, "error": str(e)}, status_code=400
                    )
            return JSONResponse(
                content={"success": False, "error": f"Unknown action: {action_id}"}, status_code=404
            )
        finally:
            current_session.reset(token)

    # Confirmation response endpoint
    @router.post("/api/confirmation/{confirmation_id}")
    async def handle_confirmation(confirmation_id: str, request: Request) -> JSONResponse:
        """Handle confirmation dialog responses."""
        session = await get_session_from_request(request)
        body = await request.json()
        confirmed = body.get("confirmed", False)

        # Resolve the confirmation in the session
        future = session.pending_confirmations.get(confirmation_id)
        if future and not future.done():
            future.set_result(confirmed)

        return JSONResponse(content={"ok": True})

    # Static file serving
    index_file = static_dir / "index.html"
    assets_dir = static_dir / "assets"
    logo_file = static_dir / "logo.png"

    if index_file.exists() and assets_dir.exists():
        # Serve index.html for the root
        @router.get("/")
        async def serve_index() -> FileResponse:
            """Serve the main UI."""
            return FileResponse(index_file)

        # Serve the bundled logo
        @router.get("/logo.png")
        async def serve_logo() -> FileResponse:
            """Serve the bundled logo."""
            if logo_file.exists():
                return FileResponse(logo_file, media_type="image/png")
            raise HTTPException(status_code=404, detail="Logo not found")

        # Serve individual asset files explicitly
        @router.get("/assets/{file_path:path}")
        async def serve_asset(file_path: str) -> FileResponse:
            """Serve static assets."""
            asset_file = assets_dir / file_path
            if asset_file.exists() and asset_file.is_file():
                # Determine media type
                media_type = None
                if file_path.endswith(".js"):
                    media_type = "application/javascript"
                elif file_path.endswith(".css"):
                    media_type = "text/css"
                return FileResponse(asset_file, media_type=media_type)
            raise HTTPException(status_code=404, detail="Asset not found")
    else:
        # Serve a placeholder if static files don't exist
        @router.get("/")
        async def serve_placeholder() -> HTMLResponse:
            """Serve placeholder when frontend is not built."""
            return HTMLResponse(
                content="""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pydantic UI</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 dark:bg-gray-900">
    <div class="min-h-screen flex items-center justify-center">
        <div class="text-center">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Pydantic UI
            </h1>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
                Frontend not built. Run the build script or use development mode.
            </p>
            <div class="space-y-2 text-left bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                <p class="text-sm font-mono text-gray-700 dark:text-gray-300">
                    # Build frontend<br>
                    cd frontend && npm run build:package
                </p>
            </div>
            <div class="mt-8">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    API Endpoints Available:
                </h2>
                <ul class="text-sm text-gray-600 dark:text-gray-400">
                    <li><code>GET {prefix}/api/schema</code></li>
                    <li><code>GET {prefix}/api/data</code></li>
                    <li><code>POST {prefix}/api/data</code></li>
                    <li><code>PATCH {prefix}/api/data</code></li>
                    <li><code>POST {prefix}/api/validate</code></li>
                    <li><code>GET {prefix}/api/config</code></li>
                </ul>
            </div>
        </div>
    </div>
</body>
</html>
""".replace("{prefix}", prefix),
                status_code=200,
            )

    # Decorator methods for custom data handlers
    def data_loader_decorator(
        func: Callable[[], BaseModel | dict[str, Any]],
    ) -> Callable[[], BaseModel | dict[str, Any]]:
        """Decorator to set a custom data loader."""
        handler.data_loader = func
        return func

    def data_saver_decorator(func: Callable[[BaseModel], None]) -> Callable[[BaseModel], None]:
        """Decorator to set a custom data saver."""
        handler.data_saver = func
        return func

    def action_decorator(action_id: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        """Decorator to register an action handler.

        The handler function receives (data: dict, controller: PydanticUIController)
        and can be sync or async.

        Example:
            @router.action("validate")
            async def validate_action(data: dict, controller):
                errors = my_validation(data)
                if errors:
                    await controller.show_validation_errors(errors)
                    await controller.show_toast("Validation failed", "error")
                else:
                    await controller.show_toast("All good!", "success")
        """

        def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
            action_handlers[action_id] = func
            return func

        return decorator

    router.data_loader = data_loader_decorator  # type: ignore
    router.data_saver = data_saver_decorator  # type: ignore
    router.action = action_decorator  # type: ignore

    return router

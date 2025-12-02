"""FastAPI router factory for Pydantic UI."""

from pathlib import Path
from typing import Any, Callable

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel

from pydantic_ui.config import FieldConfig, UIConfig
from pydantic_ui.handlers import DataHandler


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
        FastAPI APIRouter with all necessary endpoints

    Example:
        from fastapi import FastAPI
        from pydantic import BaseModel
        from pydantic_ui import create_pydantic_ui

        class Person(BaseModel):
            name: str
            age: int

        app = FastAPI()
        app.include_router(create_pydantic_ui(Person, prefix="/editor"))
    """
    if ui_config is None:
        ui_config = UIConfig()

    router = APIRouter(prefix=prefix, tags=["pydantic-ui"])

    # Create data handler
    handler = DataHandler(
        model=model,
        ui_config=ui_config,
        field_configs=field_configs,
        initial_data=initial_data,
        data_loader=data_loader,
        data_saver=data_saver,
    )

    # Store handler for decorator access
    router._pydantic_ui_handler = handler  # type: ignore

    # Get the static files directory
    static_dir = Path(__file__).parent / "static"

    # API endpoints
    @router.get("/api/schema")
    async def get_schema() -> JSONResponse:
        """Get the model schema."""
        schema = await handler.get_schema()
        return JSONResponse(content=schema)

    @router.get("/api/data")
    async def get_data() -> JSONResponse:
        """Get the current data."""
        data = await handler.get_data()
        return JSONResponse(content=data)

    @router.post("/api/data")
    async def update_data(request: Request) -> JSONResponse:
        """Update the data."""
        body = await request.json()
        data = body.get("data", body)
        result = await handler.update_data(data)
        return JSONResponse(content=result)

    @router.patch("/api/data")
    async def partial_update(request: Request) -> JSONResponse:
        """Partially update the data."""
        body = await request.json()
        path = body.get("path", "")
        value = body.get("value")
        result = await handler.partial_update(path, value)
        return JSONResponse(content=result)

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

    # Static file serving
    index_file = static_dir / "index.html"
    assets_dir = static_dir / "assets"
    
    if index_file.exists() and assets_dir.exists():
        # Serve index.html for the root
        @router.get("/")
        async def serve_index() -> FileResponse:
            """Serve the main UI."""
            return FileResponse(index_file)

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
        func: Callable[[], BaseModel | dict[str, Any]]
    ) -> Callable[[], BaseModel | dict[str, Any]]:
        """Decorator to set a custom data loader."""
        handler.data_loader = func
        return func

    def data_saver_decorator(
        func: Callable[[BaseModel], None]
    ) -> Callable[[BaseModel], None]:
        """Decorator to set a custom data saver."""
        handler.data_saver = func
        return func

    router.data_loader = data_loader_decorator  # type: ignore
    router.data_saver = data_saver_decorator  # type: ignore

    return router

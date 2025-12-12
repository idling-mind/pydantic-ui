import sys
from typing import Annotated, Literal

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel, Field

# Add project root to path to ensure pydantic_ui is importable
sys.path.insert(0, str(__file__).replace("\\", "/").rsplit("/", 3)[0])

from pydantic_ui import FieldConfig, Renderer, UIConfig, create_pydantic_ui


class RenderersDemo(BaseModel):
    """
    Demonstration of new renderer types in pydantic-ui.
    """

    title: str = Field(default="Renderers Demo", description="Title of the demo")
    # Radio Group
    theme: Annotated[
        Literal["light", "dark", "system"],
        Field(default="system", description="Application theme preference"),
        FieldConfig(renderer=Renderer.RADIO_GROUP),
    ]

    tags: list[Literal["urgent", "review", "personal", "work"]] = Field(
        default=["work"],
        description="Tags associated with the item",
    )

    # Segmented Control
    view_mode: Annotated[
        Literal["list", "grid", "map"],
        Field(default="list", description="Default view mode for items"),
        FieldConfig(renderer=Renderer.SEGMENTED_CONTROL),
    ]

    # Checklist / Multi-select
    features: Annotated[
        list[str],
        Field(default=["notifications"], description="Enabled features"),
        FieldConfig(
            renderer=Renderer.CHECKLIST,
            props={
                "options": [
                    {"value": "notifications", "label": "Push Notifications"},
                    {"value": "analytics", "label": "Usage Analytics"},
                    {"value": "beta", "label": "Beta Features"},
                    {"value": "offline", "label": "Offline Mode"},
                ]
            },
        ),
    ]

    # Markdown Editor
    notes: Annotated[
        str,
        Field(
            default="# Project Notes\n\n- [ ] Task 1\n- [ ] Task 2",
            description="Project documentation",
        ),
        FieldConfig(renderer=Renderer.MARKDOWN),
    ]


def main():
    app = FastAPI(title="Renderers Demo")

    # Create the UI router
    ui_router = create_pydantic_ui(
        model=RenderersDemo,
        ui_config=UIConfig(
            title="New Renderers Demo",
            description="Showcase of Radio Group, Checklist, Segmented Control, and Markdown renderers.",
            show_save_reset=True,
        ),
        field_configs={
            "tags": FieldConfig(
                renderer=Renderer.MULTI_SELECT,
            )
        },
    )

    app.include_router(ui_router)

    print("Starting server at http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()

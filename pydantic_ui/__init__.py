"""
Pydantic UI - Dynamic UI for editing deeply nested Pydantic models.

A FastAPI-based package that provides a modern React UI for editing
Pydantic models with tree navigation and customizable field renderers.
"""

from pydantic_ui.app import create_pydantic_ui
from pydantic_ui.config import ActionButton, FieldConfig, Renderer, UIConfig
from pydantic_ui.controller import PydanticUIController

__version__ = "0.1.0"
__all__ = [
    "create_pydantic_ui",
    "UIConfig",
    "FieldConfig",
    "Renderer",
    "ActionButton",
    "PydanticUIController",
]

"""
Example: Basic usage of pydantic-ui

This example shows how to create a simple data editing UI for a configuration model.
"""

# Import pydantic_ui components
import sys
from datetime import date, datetime
from typing import Annotated, Literal, Optional

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel, Field

from user_input import UserInput

sys.path.insert(0, str(__file__).replace("\\", "/").rsplit("/", 3)[0])

from pydantic_ui import FieldConfig, Renderer, UIConfig, create_pydantic_ui

# Create FastAPI app
app = FastAPI(title="Pydantic UI Example")

# Configure UI
ui_config = UIConfig(
    title="Tecton user input configuration",
    description="Edit the configuration for your Tecton weld analysis below.",
    collapsible_tree=True,
    show_validation=True,
)

# Field-specific configurations (alternative to annotations)
field_configs = {
    "analysis": FieldConfig(
        label="Analysis Inputs",
        description="Specify the analysis type and parameters here.",
    ),
    "advanced_settings.cores": FieldConfig(
        label="Number of CPU Cores",
        renderer=Renderer.SLIDER,
        props={"min": 0, "max": 30, "step": 1},
    ),
}

# Create and mount the pydantic-ui router
pydantic_ui_router = create_pydantic_ui(
    model=UserInput,
    ui_config=ui_config,
    field_configs=field_configs,
    prefix="/config",
)

app.include_router(pydantic_ui_router)


# Custom endpoint to demonstrate data handling
@app.get("/api/current-config")
async def get_current_config():
    """Get the current configuration (from pydantic-ui's data handler)"""
    # Access the data handler from the router
    return {"message": "Use /config/api/data to get the configuration"}


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Pydantic UI Example - Configuration Editor")
    print("=" * 60)
    print("\nOpen your browser at: http://localhost:8000/config")
    print("\nAPI Endpoints:")
    print("  - GET  /config/api/schema  - Get the UI schema")
    print("  - GET  /config/api/data    - Get current data")
    print("  - PUT  /config/api/data    - Update data")
    print("  - POST /config/api/validate - Validate data")
    print("=" * 60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)

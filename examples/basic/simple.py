"""
Example: Basic usage of pydantic-ui

This example shows how to create a simple data editing UI for a configuration model.
"""

# Import pydantic_ui components
import sys
from datetime import date, datetime
from typing import Annotated

# StrEnum is available in Python 3.11+, define it for older versions
try:
    from enum import StrEnum
except ImportError:
    from enum import Enum

    class StrEnum(str, Enum):
        pass


import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel, Field

sys.path.insert(0, str(__file__).replace("\\", "/").rsplit("/", 3)[0])

from pydantic_ui import FieldConfig, Renderer, UIConfig, create_pydantic_ui


class Currency(StrEnum):
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    JPY = "JPY"
    SEK = "SEK"


class Compensation(BaseModel):
    amount: Annotated[
        float, FieldConfig(renderer=Renderer.SLIDER, props={"min": 0, "max": 1000000, "step": 1000})
    ]
    currency: Currency


class Person(BaseModel):
    name: str
    age: int
    birthday: date
    compensation: Compensation = Field(
        description="Compensation details for the person", title="Salary"
    )
    fields: dict[str, str] | None = None


class MyModel(BaseModel):
    """My model configuration"""

    name: str
    description: str
    created: datetime
    users: list[Person]


# Create FastAPI app
app = FastAPI(title="Pydantic UI Example")

# Configure UI
ui_config = UIConfig(
    title="My Model Editor",
    description="Edit the fields of MyModel below.",
    collapsible_tree=True,
    show_validation=True,
)

# Field-specific configurations (alternative to annotations)
field_configs = {
    "created": FieldConfig(
        label="Created Date",
        placeholder="Select a date",
        renderer=Renderer.DATE_PICKER,
    ),
    "users.[].age": FieldConfig(
        label="User Age",
        renderer=Renderer.SLIDER,
        props={"min": 0, "max": 120, "step": 1},
    ),
}

# Create and mount the pydantic-ui router
pydantic_ui_router = create_pydantic_ui(
    model=MyModel,
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

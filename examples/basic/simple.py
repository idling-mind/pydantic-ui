"""
Example: Basic usage of pydantic-ui

This example shows how to create a simple data editing UI for a configuration model.
"""

# Import pydantic_ui components
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Annotated, Literal

from pydantic_ui.config import DisplayConfig, ViewDisplay

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

from pydantic_ui import (
    ActionButton,
    FieldConfig,
    PydanticUIController,
    Renderer,
    UIConfig,
    create_pydantic_ui,
)


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
    single_user: Person
    users: list[Person]
    optional_string: str | None = "my string"
    optional_number: float | None = 42
    optional_date: date | None = str(date.today())
    optional_boolean: bool | None = None
    optional_color: str | None = "#333333"
    optional_complex: str | Person | None = None
    optional_complex_with_list: str | Person | list[Person] | None = None
    optional_complex_with_default: str | Person | None = "default value"
    optional_list: list[int] | None = None
    my_field: Literal["this", "that", "other"] = Field(
        default="this",
        title="My Field",
        description="An example of a field with limited choices",
    )


# Create FastAPI app
app = FastAPI(title="Pydantic UI Example")

# Attribute-specific configurations (alternative to annotations)
attr_configs = {
    "created": FieldConfig(
        placeholder="Select a date",
        renderer=Renderer.DATE_PICKER,
        display=DisplayConfig(
            title="Creation Date",
            subtitle="Date when this config was created",
            help_text="The date when this configuration was created",
        ),
    ),
    "users": FieldConfig(
        display=DisplayConfig(
            title="User List",
            subtitle="List of users",
            help_text="List of users in the system",
            tree=ViewDisplay(title="Users - tree", subtitle="This is the users tree view"),
            card=ViewDisplay(title="Users - card", subtitle="This is the users card view", help_text="Card view help text"),
            detail=ViewDisplay(title="Users - detail", subtitle="This is the users detail view"),
        ),
    ),
    "users.[]": FieldConfig(
        display=DisplayConfig(
            title="{name}: {age} years old",
            subtitle="User details: {birthday}",
            tree=ViewDisplay(title="{name} - tree", subtitle="This is the user tree view"),
        ),
    ),
    "users.[].age": FieldConfig(
        renderer=Renderer.SLIDER,
        props={"min": 0, "max": 120, "step": 1},
        display=DisplayConfig(
            title="User Age",
            subtitle="User's age in years",
            help_text="Specify the age in years",
        )
    ),
    "optional_color": FieldConfig(
        renderer=Renderer.COLOR_PICKER,
        display=DisplayConfig(
            title="Favorite Color",
            subtitle="Pick your favorite color",
            help_text="Pick your favorite color",
            detail=ViewDisplay(title="Color Picker", subtitle="This is the color picker view"),
        ),
    ),
    # "my_field": FieldConfig(
    #     label="Custom My Field",
    #     renderer=Renderer.RADIO_GROUP,
    # ),
    # Configure union variant labels/descriptions using path-based attr_configs
    # Use the variant class name in the path to target specific union variants
    "optional_complex_with_list.Person": FieldConfig(
        display=DisplayConfig(
            title="Person (via attr_config)",
            subtitle="Person variant of the union",
            help_text="This label and help_text are set via attr_configs path",
        ),
    ),
    "optional_complex_with_list.Person.name": FieldConfig(
        display=DisplayConfig(
            title="Person (via attr_config) Name",
        ),
    ),
    "optional_complex_with_list.list[Person]": FieldConfig(
        display=DisplayConfig(
            title="List of Persons (via attr_config)",
            help_text="This label and help_text are set via attr_configs path",
        ),
    ),
    "optional_complex.str": FieldConfig(
        display=DisplayConfig(
            title="Some random string",
            help_text="This is the string variant of the union",
        ),
    ),
    "optional_complex_with_default.Person": FieldConfig(
        display=DisplayConfig(
            title="Person with Default",
            help_text="Union variant configured via attr_configs instead of class_configs",
            card=ViewDisplay(title="Person Card", subtitle="This is the person card view"),
        ),
    ),
    "optional_complex_with_default.str": FieldConfig(
        display=DisplayConfig(
            title="String with Default",
            help_text="String variant of union with default value",
            card=ViewDisplay(title="String Card", subtitle="This is the string card view"),
            detail=ViewDisplay(title="String Detail", subtitle="This is the string detail view"),
        ),
    ),
}

# Configure UI
ui_config = UIConfig(
    title="My Model Editor",
    subtitle="Edit the fields of MyModel below.",
    collapsible_tree=True,
    show_validation=True,
    show_save_reset=True,
    class_configs={
        "Person": FieldConfig(
            display=DisplayConfig(
                title="Person Details",
                help_text=Path("c:/tools/dev/pydantic-ui/README.md").read_text(encoding="utf-8"),
                card=ViewDisplay(title="Person Card", subtitle="This is the person card view"),
                tree=ViewDisplay(title="Person - tree", subtitle="This is the person tree view"),
            ),
        ),
        "Compensation": FieldConfig(
            display=DisplayConfig(
                title="Compensation Details",
                help_text="""
# Compensation information including amount and currency

Use this section to specify the compensation details for the person.

You can get the current exchange rates from [ExchangeRate-API](https://www.exchangerate-api.com/).

Here are some example rates:

| Currency | Rate to USD |
|----------|-------------|
| EUR      | 1.1         |
| GBP      | 1.3         |
| JPY      | 0.009       |
| SEK      | 0.11        |

Here's the flag for Sweden: ![](https://swedishpress.com/wp-content/uploads/2021/01/Sweden-Flag.jpg)

```python
import requests
import sys

comp = Compensation(amount=100000, currency=Currency.SEK)
```
""",
            ),
        )
    },
    attr_configs=attr_configs,
    actions=[
        ActionButton(
            id="print",
            label="Print Data",
            variant="secondary",
            icon="check-circle",
            tooltip="Run custom validation",
        ),
    ],
)

# Create and mount the pydantic-ui router
pydantic_ui_router = create_pydantic_ui(
    model=MyModel,
    ui_config=ui_config,
    prefix="/config",
)

app.include_router(pydantic_ui_router)


# Custom action handlers using the decorator
@pydantic_ui_router.action("print")
async def handle_print(data: dict, _controller: PydanticUIController):
    """
    Full Pydantic validation + custom business rules.

    This demonstrates how to:
    1. Run Pydantic's built-in validation (type checks, constraints like ge/le, etc.)
    2. Add custom business rule validation on top
    3. Convert all errors to the UI format
    """
    print("MyModel data to validate:", data)


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

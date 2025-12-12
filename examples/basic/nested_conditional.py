"""
Example: Nested Conditional Fields

This example demonstrates:
1. Conditional visibility of fields within a nested object based on other fields in that same object.
2. Conditional visibility of fields based on values in the parent/root object.
3. Conditional visibility of an entire nested object.
"""

# Add the project root to the path so we can import pydantic_ui
# This allows running the example directly without installing the package
import os
import sys
from typing import Annotated, Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from pydantic_ui import FieldConfig, UIConfig, create_pydantic_ui


class Address(BaseModel):
    street: str = Field(default="", title="Street Address")
    city: str = Field(default="", title="City")
    country: Literal["USA", "Canada", "Other"] = Field(default="USA", title="Country")

    # Conditional visibility based on sibling field (in the same nested object)
    # We access it via the full path from root 'data'.
    # Note: We use optional chaining (?.) or checks to avoid errors if address is undefined
    state: Annotated[
        str | None,
        FieldConfig(
            visible_when="data.address && data.address.country === 'USA'", label="State (USA only)"
        ),
    ] = None

    province: Annotated[
        str | None,
        FieldConfig(
            visible_when="data.address && data.address.country === 'Canada'",
            label="Province (Canada only)",
        ),
    ] = None


class Employment(BaseModel):
    company: str = Field(default="", title="Company Name")
    position: str = Field(default="", title="Job Title")

    # Conditional visibility based on a field in the ROOT object (age)
    # This demonstrates cross-level dependency
    years_experience: Annotated[
        int | None,
        FieldConfig(
            visible_when="data.age >= 18",
            help_text="Years of experience is only asked for adults (18+)",
        ),
    ] = None


class UserProfile(BaseModel):
    name: str = Field(default="John Doe", title="Full Name")
    age: int = Field(
        default=25,
        ge=0,
        le=120,
        description="Try changing age < 18 to hide 'Years Experience' in Employment",
    )

    # Nested object that is always visible
    address: Address = Field(default_factory=Address)

    is_employed: bool = Field(default=False, title="Is Employed?")

    # Conditionally show the entire nested object based on a root field
    employment: Annotated[
        Employment | None, FieldConfig(visible_when="data.is_employed === true")
    ] = None


if __name__ == "__main__":
    app = FastAPI()

    # Create the app
    router = create_pydantic_ui(
        UserProfile,
        ui_config=UIConfig(
            title="Nested Conditional Fields Example",
            description="Demonstrating conditional visibility in nested objects.",
        ),
    )

    app.include_router(router)

    print("Starting Pydantic UI...")
    print("Go to http://localhost:8000 to see the UI.")

    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

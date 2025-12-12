"""
Example: Conditional Fields

This example demonstrates how to conditionally show or hide fields based on
the values of other fields using the `visible_when` property in `FieldConfig`.
"""

import sys
from typing import Annotated, Literal

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel, Field

# Add the project root to the path so we can import pydantic_ui
sys.path.insert(0, str(__file__).replace("\\", "/").rsplit("/", 3)[0])

from pydantic_ui import FieldConfig, UIConfig, create_pydantic_ui


class UserProfile(BaseModel):
    # Simple boolean toggle
    has_nickname: bool = Field(default=False, title="Do you have a nickname?")

    nickname: Annotated[
        str | None,
        FieldConfig(
            visible_when="data.has_nickname === true",
            help_text="This field is only visible when 'Do you have a nickname?' is checked.",
        ),
    ] = None

    # Select-based logic
    contact_method: Literal["Email", "Phone", "Mail"] = Field(
        default="Email", title="Preferred Contact Method"
    )

    email: Annotated[
        str | None, FieldConfig(visible_when="data.contact_method === 'Email'", renderer="email")
    ] = None

    phone_number: Annotated[
        str | None, FieldConfig(visible_when="data.contact_method === 'Phone'")
    ] = None

    address: Annotated[
        str | None, FieldConfig(visible_when="data.contact_method === 'Mail'", renderer="text_area")
    ] = None

    # Numeric logic
    age: int = Field(default=25, ge=0, le=120)

    guardian_name: Annotated[
        str | None,
        FieldConfig(visible_when="data.age < 18", label="Guardian Name (Required for minors)"),
    ] = None

    # Complex logic (multiple conditions)
    subscription_type: Literal["Free", "Pro", "Enterprise"] = "Free"

    wants_newsletter: bool = True

    # Visible if Pro/Enterprise AND wants newsletter
    newsletter_topic: Annotated[
        Literal["Tech", "Business", "Lifestyle"],
        FieldConfig(
            visible_when="(data.subscription_type === 'Pro' || data.subscription_type === 'Enterprise') && data.wants_newsletter",
            label="Premium Newsletter Topic",
        ),
    ] = "Tech"


def main():
    app = FastAPI()

    # Create the UI router
    ui_router = create_pydantic_ui(
        UserProfile,
        ui_config=UIConfig(
            title="Conditional Fields Example",
            description="Demonstrating dynamic field visibility using JavaScript expressions.",
        ),
    )

    app.include_router(ui_router)

    print("Starting server at http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()

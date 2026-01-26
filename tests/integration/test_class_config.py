from typing import Annotated

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from pydantic_ui import DisplayConfig, FieldConfig, UIConfig, create_pydantic_ui


class Address(BaseModel):
    street: str
    city: str


class User(BaseModel):
    name: str
    address: Address
    billing_address: Annotated[
        Address,
        FieldConfig(display=DisplayConfig(title="Billing Address", help_text="Specific help")),
    ]


@pytest.mark.asyncio
async def test_class_config():
    class_configs = {
        "Address": FieldConfig(
            display=DisplayConfig(title="Global Address Label", help_text="Global help"),
            renderer="json",
        )
    }

    ui_config = UIConfig(class_configs=class_configs)

    app = FastAPI()
    router = create_pydantic_ui(User, ui_config=ui_config)
    app.include_router(router)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/schema")
        assert response.status_code == 200
        schema = response.json()

        fields = schema["fields"]

        # Check address field (should use class config)
        address_config = fields["address"]["ui_config"]
        assert address_config["display"]["title"] == "Global Address Label"
        assert address_config["display"]["help_text"] == "Global help"
        assert address_config["renderer"] == "json"

        # Check billing_address field (should merge/override)
        billing_config = fields["billing_address"]["ui_config"]
        assert billing_config["display"]["title"] == "Billing Address"  # Overridden
        assert billing_config["display"]["help_text"] == "Specific help"  # Overridden
        assert billing_config["renderer"] == "json"  # Inherited

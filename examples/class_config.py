from typing import Annotated

from fastapi import FastAPI
from pydantic import BaseModel

from pydantic_ui import DisplayConfig, FieldConfig, Renderer, UIConfig, create_pydantic_ui


class Address(BaseModel):
    street: str
    city: str
    zip_code: str


class User(BaseModel):
    name: str
    # Address should get config from class_configs
    address: Address
    # This one overrides class config
    billing_address: Annotated[
        Address, FieldConfig(display=DisplayConfig(title="Billing Address", subtitle="Where to send the bill"))
    ]


# Define class configs
class_configs = {
    "Address": FieldConfig(
        display=DisplayConfig(
            title="Global Address Label",
            subtitle="Global address help text",
        ),
        renderer=Renderer.JSON,  # Just to test renderer override
    )
}

ui_config = UIConfig(
    title="Class Config Demo",
    class_configs=class_configs,
)

app = FastAPI()
router = create_pydantic_ui(User, ui_config=ui_config)
app.include_router(router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

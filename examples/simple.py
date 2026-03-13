from fastapi import FastAPI
from pydantic import BaseModel, Field

from pydantic_ui import DisplayConfig, FieldConfig, Renderer, UIConfig, create_pydantic_ui


# Define your Pydantic model
class Address(BaseModel):
    street: str
    city: str
    zipcode: str


class Person(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(gt=0, lt=150)
    email: str
    address: Address = Field(description="Permanent address")
    tags: list[str] = []


# Create FastAPI app and mount pydantic-ui
app = FastAPI()

app.include_router(
    create_pydantic_ui(
        Person,
        prefix="/editor",
        ui_config=UIConfig(
            title="Person Editor",
            show_save_reset=True,
            attr_configs={
                "age": FieldConfig(
                    renderer=Renderer.SLIDER,
                    display=DisplayConfig(
                        title="User Age",
                    ),
                )
            },
        ),
    ),
)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

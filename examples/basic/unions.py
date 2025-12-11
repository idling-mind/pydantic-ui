"""Example demonstrating Union and Discriminated Union support in Pydantic UI.

This example shows:
1. Discriminated Unions - unions with a discriminator field (e.g., pet_type)
2. Regular Unions - unions without discriminator (type is inferred)
3. Primitive Unions - unions of basic types (str, int)
4. Arrays of Unions - lists containing union items
"""

from typing import Annotated, Literal

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel, Field

from pydantic_ui import UIConfig, create_pydantic_ui

# ============================================================================
# Example 1: Discriminated Union with string discriminator
# ============================================================================


class ObjectWithList(BaseModel):
    """object with a list"""

    attr1: str
    attr2: list[str]


class Cat(BaseModel):
    """A cat pet."""

    pet_type: Literal["cat"] = "cat"
    name: str = Field(default="Whiskers", description="The cat's name")
    meows: int = Field(default=5, ge=0, le=100, description="How many times it meows per hour")
    indoor: bool = Field(default=True, description="Is it an indoor cat?")
    toys: list[str]
    another_union_object: int | list[int] | ObjectWithList


class Dog(BaseModel):
    """A dog pet."""

    pet_type: Literal["dog"] = "dog"
    name: str = Field(default="Buddy", description="The dog's name")
    barks: float = Field(default=3.5, ge=0, description="Average barks per minute")
    breed: str = Field(default="Labrador", description="Dog breed")
    toys: list[str]


class Lizard(BaseModel):
    """A lizard pet."""

    pet_type: Literal["reptile", "lizard"] = "lizard"  # Multiple literal values
    name: str = Field(default="Scales", description="The lizard's name")
    has_scales: bool = Field(default=True, description="Does it have scales?")
    length_cm: float = Field(default=15.0, ge=0, description="Length in centimeters")


# ============================================================================
# Example 2: Nested Discriminated Union (two-level discrimination)
# ============================================================================


class BlackCat(BaseModel):
    """A black cat."""

    pet_type: Literal["cat"] = "cat"
    color: Literal["black"] = "black"
    name: str = Field(default="Shadow", description="Cat name")
    brings_luck: bool = Field(default=False, description="Brings good luck?")


class WhiteCat(BaseModel):
    """A white cat."""

    pet_type: Literal["cat"] = "cat"
    color: Literal["white"] = "white"
    name: str = Field(default="Snowball", description="Cat name")
    fluffy: bool = Field(default=True, description="Is it fluffy?")


# ============================================================================
# Example 3: Simple Union (no discriminator)
# ============================================================================


class Circle(BaseModel):
    """A circle shape."""

    radius: float = Field(default=5.0, ge=0, description="Radius of the circle")
    color: str = Field(default="red", description="Fill color")


class Rectangle(BaseModel):
    """A rectangle shape."""

    width: float = Field(default=10.0, ge=0, description="Width of rectangle")
    height: float = Field(default=5.0, ge=0, description="Height of rectangle")
    color: str = Field(default="blue", description="Fill color")


class Triangle(BaseModel):
    """A triangle shape."""

    base: float = Field(default=8.0, ge=0, description="Base length")
    height: float = Field(default=6.0, ge=0, description="Height")
    color: str = Field(default="green", description="Fill color")


# ============================================================================
# Main Configuration Model
# ============================================================================


class UnionExampleConfig(BaseModel):
    """Configuration demonstrating various Union types in Pydantic UI.

    This example shows how Pydantic UI handles:
    - Discriminated unions (with field-based type selection)
    - Regular unions (with type inference)
    - Arrays of union types
    - Primitive unions
    """

    # Basic info
    config_name: str = Field(default="My Union Example", description="Name for this configuration")

    # Discriminated Union - single pet
    favorite_pet: Annotated[
        Cat | Dog | Lizard,
        Field(
            discriminator="pet_type",
            description="Your favorite pet (discriminated by pet_type field)",
        ),
    ] = Field(default_factory=lambda: Cat())

    # Array of Discriminated Union - multiple pets
    pets: Annotated[
        list[Annotated[Cat | Dog | Lizard, Field(discriminator="pet_type")]],
        Field(description="Your collection of pets"),
    ] = Field(default_factory=lambda: [Cat(), Dog()])

    # Regular Union (no discriminator) - geometry
    current_shape: Circle | Rectangle | Triangle = Field(
        default_factory=lambda: Circle(),
        description="Currently selected shape (no discriminator, type inferred)",
    )

    # Array of Regular Union
    shapes: list[Circle | Rectangle | Triangle] = Field(
        default_factory=lambda: [Circle(), Rectangle()], description="Collection of shapes"
    )

    # Primitive Union
    identifier: str | int = Field(
        default="ID-001", description="Can be either a string ID or numeric ID"
    )

    # Optional Union
    backup_pet: Cat | Dog | None = Field(default=None, description="Optional backup pet")


# ============================================================================
# FastAPI Application
# ============================================================================

app = FastAPI(title="Union Example", description="Demonstrating Union support")

# Create the Pydantic UI router
ui_config = UIConfig(
    title="Union Types Demo",
    description="Explore how Pydantic UI handles Union and Discriminated Union types",
    show_save_reset=True,
    show_types=True,
)

router = create_pydantic_ui(
    UnionExampleConfig,
    prefix="/config",
    ui_config=ui_config,
)

app.include_router(router)


@app.get("/")
async def root():
    return {"message": "Visit /config for the Union example UI"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

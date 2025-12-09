from datetime import date
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class Theme(str, Enum):
    LIGHT = "light"
    DARK = "dark"
    SYSTEM = "system"


class ContactType(str, Enum):
    EMAIL = "email"
    PHONE = "phone"
    ADDRESS = "address"


class Address(BaseModel):
    street: str
    city: str
    state: str
    zip_code: str
    country: str = Field(default="USA")


class Contact(BaseModel):
    type: ContactType
    value: str
    photo: str | None = None
    is_primary: bool = Field(default=False)


class SubSettings(BaseModel):
    enabled: bool
    level: int = Field(ge=1, le=10)
    options: list[str]


class Settings(BaseModel):
    theme: Theme
    notifications: bool
    language: str = Field(default="en")
    sub_settings: SubSettings
    preferences: dict[str, str]


class Item(BaseModel):
    id: int
    name: str
    description: str | None = None
    quantity: float
    tags: list[str]
    metadata: dict[str, str]


class Category(BaseModel):
    name: str
    items: list[Item]


class DeepNestedModel(BaseModel):
    name: str
    age: int = Field(ge=0)
    is_active: bool
    created_at: date
    tags: list[str]
    metadata: dict[str, str] = Field(description="Additional metadata as key-value pairs")
    address: Address
    contacts: list[Contact]
    settings: Settings | None = None
    categories: list[Category]
    optional_field: str | None = None
    literal_field: Literal["option1", "option2", "option3"] = "option1"
    dict_of_models: dict[str, Address]
    list_of_dicts: list[dict[str, int]]

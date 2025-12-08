from datetime import date
from typing import Dict, List, Optional, Literal
from enum import Enum
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
    options: List[str]


class Settings(BaseModel):
    theme: Theme
    notifications: bool
    language: str = Field(default="en")
    sub_settings: SubSettings
    preferences: Dict[str, str]


class Item(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    quantity: float
    tags: List[str]
    metadata: Dict[str, str]


class Category(BaseModel):
    name: str
    items: List[Item]
    subcategories: List["Category"]  # Recursive


class DeepNestedModel(BaseModel):
    name: str
    age: int
    is_active: bool
    created_at: date
    tags: List[str]
    metadata: Dict[str, str] = Field(description="Additional metadata as key-value pairs")
    address: Address
    contacts: List[Contact]
    settings: Settings | None = None
    categories: List[Category]
    optional_field: Optional[str] = None
    literal_field: Literal["option1", "option2", "option3"] = "option1"
    dict_of_models: Dict[str, Address]
    list_of_dicts: List[Dict[str, int]]

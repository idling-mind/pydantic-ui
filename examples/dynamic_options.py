from datetime import date
from typing import Literal

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel, Field

from pydantic_ui import (
    DisplayConfig,
    FieldConfig,
    Renderer,
    UIConfig,
    ViewDisplay,
    create_pydantic_ui,
)


class Subclass(BaseModel):
    id: int
    name: list[str]


class Address(BaseModel):
    street: str
    city: str = "Unknown"
    zip_code: str


class User(BaseModel):
    id: int
    name: str
    address: Address
    role: Literal["Engineer", "Manager", "Designer", "QA"]
    active: bool = True
    date_joined: date = Field(default_factory=lambda: date(2024, 1, 1))
    age: int = Field(gt=20, le=150, default=30, description="Age in years")
    teams: list[Literal["Frontend", "Backend", "Design", "QA"]] = Field(default_factory=list)
    years_at_company: float = Field(default=0, description="Number of years at the company")


class Department(BaseModel):
    name: str
    staff: list[User]


class Task(BaseModel):
    title: str
    description: str = ""

    # Deeply nested field using options from another branch of the tree (hr_data.staff)
    assignee: str = None

    priority: Literal["low", "medium", "high", "critical"] = "medium"

    # Multi-select example
    reviewers: list[str] = Field(default_factory=list)

    other_field: str | list[Subclass]


class Project(BaseModel):
    name: str
    tasks: list[Task]


class CompanyData(BaseModel):
    # Source of options: deeply nested list
    hr_data: Department = Field(
        default_factory=lambda: Department(
            name="Engineering",
            staff=[
                User(id=1, name="Alice", role="Engineer"),
                User(id=2, name="Bob", role="Manager"),
                User(id=3, name="Charlie", role="Designer"),
                User(id=4, name="Dave", role="QA"),
            ],
        )
    )

    # Target for options: deeply nested fields inside tasks
    active_project: Project = Field(
        default_factory=lambda: Project(
            name="Website Redesign",
            tasks=[
                Task(title="Design Mockups", assignee="Charlie"),
                Task(title="Frontend Implementation", reviewers=["Bob", "Dave"]),
            ],
        )
    )


attr_configs = {
    "active_project.tasks.[].assignee": FieldConfig(
        renderer=Renderer.SELECT,
        options_from="hr_data.staff.[].name",
    ),
    "active_project.tasks.[].reviewers": FieldConfig(
        renderer=Renderer.MULTI_SELECT,
        options_from="hr_data.staff.[].name",
    ),
    "active_project.tasks.[].other_field.[].name": FieldConfig(
        renderer=Renderer.MULTI_SELECT,
        options_from="hr_data.staff.[].name",
    ),
    "hr_data.staff": FieldConfig(
        display=DisplayConfig(
            table=ViewDisplay(
                pinned_columns=["__check", "__row_number", "name"],
                column_widths={"id": 80, "name": 220, "role": 140},
            ),
        )
    ),
    "hr_data.staff.[]": FieldConfig(
        display=DisplayConfig(title="{name} ({role})"),
    ),
    "hr_data.staff.[].age": FieldConfig(
        renderer=Renderer.SLIDER,
        props={"min": 30, "max": 150, "step": 1},
    ),
}

app = FastAPI()
app.include_router(
    create_pydantic_ui(
        CompanyData,
        ui_config=UIConfig(
            attr_configs=attr_configs,
            show_save_reset=True,
            table_column_widths=160,
            max_visible_errors=3,
        ),
    )
)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

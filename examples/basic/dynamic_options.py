from typing import Annotated
from pydantic import BaseModel, Field
from pydantic_ui import create_pydantic_ui, FieldConfig, Renderer
import uvicorn
from fastapi import FastAPI


class Subclass(BaseModel):
    id: int
    name: str


class User(BaseModel):
    id: int
    name: str
    role: str


class Department(BaseModel):
    name: str
    staff: list[User]


class Task(BaseModel):
    title: str
    description: str = ""

    # Deeply nested field using options from another branch of the tree (hr_data.staff)
    assignee: str = None

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
}

app = FastAPI()
app.include_router(
    create_pydantic_ui(CompanyData, ui_config=UIConfig(attr_configs=attr_configs))
)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

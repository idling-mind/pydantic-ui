from __future__ import annotations

from typing import Annotated

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel, NegativeInt, PositiveInt

from pydantic_ui import DisplayConfig, FieldConfig, UIConfig, create_pydantic_ui


class PositiveHint:
    def __repr__(self) -> str:
        return "PositiveHint()"


class DisabledHint:
    def __repr__(self) -> str:
        return "DisabledHint()"


class UnionDisplayModel(BaseModel):
    timeout: Annotated[int, PositiveHint()] | Annotated[int, DisabledHint()] = 30


EnabledTimeout = Annotated[int, PositiveHint()]
DisabledTimeout = Annotated[int, DisabledHint()]


class UnionDisplayAliasModel(BaseModel):
    timeout: EnabledTimeout | DisabledTimeout = 30


class TimeoutAliasModel(BaseModel):
    server_timeout: PositiveInt | NegativeInt = 30


@pytest.mark.asyncio
async def test_union_field_display_title_override_and_variant_labels():
    ui_config = UIConfig(
        attr_configs={
            "timeout": FieldConfig(
                display=DisplayConfig(
                    title="Request Timeout Mode",
                    subtitle="Select the timeout behavior",
                )
            )
        }
    )

    app = FastAPI()
    app.include_router(create_pydantic_ui(UnionDisplayModel, ui_config=ui_config, prefix="/editor"))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/editor/api/schema")

    assert response.status_code == 200
    schema = response.json()

    timeout_field = schema["fields"]["timeout"]
    assert timeout_field["type"] == "union"
    assert timeout_field["ui_config"]["display"]["title"] == "Request Timeout Mode"
    assert timeout_field["ui_config"]["display"]["subtitle"] == "Select the timeout behavior"

    variants = timeout_field["variants"]
    assert len(variants) == 2
    assert variants[0]["variant_name"] != variants[1]["variant_name"]

    variant_names = {variant["variant_name"] for variant in variants}
    assert "Annotated[int, PositiveHint()]" in variant_names
    assert "Annotated[int, DisabledHint()]" in variant_names


@pytest.mark.asyncio
async def test_union_variants_prefer_user_defined_alias_names_when_available():
    app = FastAPI()
    app.include_router(create_pydantic_ui(UnionDisplayAliasModel, prefix="/editor"))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/editor/api/schema")

    assert response.status_code == 200
    schema = response.json()
    variants = schema["fields"]["timeout"]["variants"]
    variant_names = {variant["variant_name"] for variant in variants}

    assert variant_names == {"EnabledTimeout", "DisabledTimeout"}


@pytest.mark.asyncio
async def test_union_variants_use_imported_constraint_alias_names_when_available():
    app = FastAPI()
    app.include_router(create_pydantic_ui(TimeoutAliasModel, prefix="/editor"))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/editor/api/schema")

    assert response.status_code == 200
    schema = response.json()

    timeout_field = schema["fields"]["server_timeout"]
    assert timeout_field["type"] == "union"

    variants = timeout_field["variants"]
    variant_names = {variant["variant_name"] for variant in variants}
    variant_constraints = {
        variant["variant_name"]: variant.get("constraints", {}) for variant in variants
    }

    assert variant_names == {"PositiveInt", "NegativeInt"}
    assert variant_constraints["PositiveInt"].get("exclusiveMinimum") == 0
    assert variant_constraints["NegativeInt"].get("exclusiveMaximum") == 0

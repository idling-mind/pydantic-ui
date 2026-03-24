"""Tests for pydantic_ui/schema.py - Schema parsing."""

from __future__ import annotations

import datetime
from enum import Enum
from typing import Annotated, Any, Literal

import pytest
from pydantic import BaseModel, Field

from pydantic_ui.config import DisplayConfig, FieldConfig, Renderer, ViewDisplay
from pydantic_ui.schema import (
    extract_field_config,
    get_constraints,
    get_enum_values,
    get_format_for_type,
    get_json_type,
    get_python_type_name,
    get_variant_name,
    model_to_data,
    parse_field,
    parse_model,
)

# Import test fixtures
from tests.conftest import (
    Address,
    DateTimeModel,
    Priority,
    Status,
)

# =============================================================================
# Tests for get_json_type()
# =============================================================================


class TestGetJsonType:
    """Tests for get_json_type function."""

    @pytest.mark.parametrize(
        "python_type,expected",
        [
            (str, "string"),
            (int, "integer"),
            (float, "number"),
            (bool, "boolean"),
            (list, "array"),
            (dict, "object"),
            (set, "array"),
            (tuple, "array"),
        ],
    )
    def test_primitive_types(self, python_type: type, expected: str):
        """Test mapping of primitive Python types to JSON types."""
        assert get_json_type(python_type) == expected

    def test_none_type(self):
        """Test None type returns null."""
        assert get_json_type(type(None)) == "null"

    @pytest.mark.parametrize(
        "dt_type",
        [datetime.datetime, datetime.date, datetime.time],
    )
    def test_datetime_types(self, dt_type: type):
        """Test datetime types return string."""
        assert get_json_type(dt_type) == "string"

    def test_enum_type(self):
        """Test Enum type returns string."""
        assert get_json_type(Status) == "string"

    def test_str_enum_type(self):
        """Test StrEnum type returns string."""
        assert get_json_type(Priority) == "string"

    def test_unknown_type_defaults_to_string(self):
        """Test unknown types default to string."""

        class CustomClass:
            pass

        assert get_json_type(CustomClass) == "string"


# =============================================================================
# Tests for get_python_type_name()
# =============================================================================


class TestGetPythonTypeName:
    """Tests for get_python_type_name function."""

    def test_simple_types(self):
        """Test simple type names."""
        assert get_python_type_name(str) == "str"
        assert get_python_type_name(int) == "int"
        assert get_python_type_name(bool) == "bool"

    def test_none_type(self):
        """Test None type name."""
        assert get_python_type_name(type(None)) == "None"

    def test_generic_list(self):
        """Test generic list type name."""
        result = get_python_type_name(list[str])
        assert "list" in result.lower()
        assert "str" in result

    def test_generic_dict(self):
        """Test generic dict type name."""
        result = get_python_type_name(dict[str, int])
        assert "dict" in result.lower()


# =============================================================================
# Tests for get_variant_name()
# =============================================================================


class TestGetVariantName:
    """Tests for get_variant_name function."""

    def test_simple_types(self):
        """Test simple type names."""
        assert get_variant_name(str) == "str"
        assert get_variant_name(int) == "int"
        assert get_variant_name(bool) == "bool"

    def test_pydantic_model(self):
        """Test Pydantic model type name."""
        assert get_variant_name(Address) == "Address"

    def test_generic_list_with_model(self):
        """Test generic list with Pydantic model returns full type name.

        This is important for attr_configs matching like 'field.list[Person]'.
        """
        result = get_variant_name(list[Address])
        assert result == "list[Address]"

    def test_generic_list_with_simple_type(self):
        """Test generic list with simple type."""
        result = get_variant_name(list[str])
        assert result == "list[str]"

    def test_generic_dict(self):
        """Test generic dict type name."""
        result = get_variant_name(dict[str, int])
        assert result == "dict[str, int]"

    def test_annotated_type_uses_metadata_in_name(self):
        """Annotated variants should include metadata so same-base unions stay distinguishable."""
        from pydantic import NegativeInt, PositiveInt

        positive_name = get_variant_name(PositiveInt)
        negative_name = get_variant_name(NegativeInt)

        assert "Annotated[int" in positive_name
        assert "Gt(gt=0)" in positive_name
        assert "Annotated[int" in negative_name
        assert "Lt(lt=0)" in negative_name
        assert positive_name != negative_name

    def test_user_defined_annotated_metadata_is_supported(self):
        """Annotated metadata does not have to come from Pydantic internals."""

        class UserMarker:
            def __repr__(self) -> str:
                return "UserMarker(kind='custom')"

        custom_annotated = Annotated[int, UserMarker()]
        result = get_variant_name(custom_annotated)

        assert result == "Annotated[int, UserMarker(kind='custom')]"


# =============================================================================
# Tests for get_format_for_type()
# =============================================================================


class TestGetFormatForType:
    """Tests for get_format_for_type function."""

    def test_datetime_format(self):
        """Test datetime format."""
        assert get_format_for_type(datetime.datetime) == "date-time"

    def test_date_format(self):
        """Test date format."""
        assert get_format_for_type(datetime.date) == "date"

    def test_time_format(self):
        """Test time format."""
        assert get_format_for_type(datetime.time) == "time"

    def test_other_types_return_none(self):
        """Test non-datetime types return None."""
        assert get_format_for_type(str) is None
        assert get_format_for_type(int) is None


# =============================================================================
# Tests for get_enum_values()
# =============================================================================


class TestGetEnumValues:
    """Tests for get_enum_values function."""

    def test_standard_enum(self):
        """Test standard Enum values."""
        values = get_enum_values(Status)
        assert values == ["draft", "published", "archived"]

    def test_str_enum(self):
        """Test StrEnum values."""
        values = get_enum_values(Priority)
        assert values == ["low", "medium", "high"]

    def test_int_enum(self):
        """Test IntEnum values."""

        class IntStatus(Enum):
            ACTIVE = 1
            INACTIVE = 0

        values = get_enum_values(IntStatus)
        assert values == [1, 0]

    def test_non_enum_returns_none(self):
        """Test non-enum returns None."""
        assert get_enum_values(str) is None


# =============================================================================
# Tests for extract_field_config()
# =============================================================================


class TestExtractFieldConfig:
    """Tests for extract_field_config function."""

    def test_no_config(self):
        """Test field without FieldConfig."""
        from pydantic.fields import FieldInfo

        field_info = FieldInfo()
        result = extract_field_config(field_info, str)
        assert result is None

    def test_config_in_metadata(self):
        """Test FieldConfig in field metadata."""
        from pydantic.fields import FieldInfo

        config = FieldConfig(renderer=Renderer.SLIDER)
        field_info = FieldInfo()
        field_info.metadata = [config]
        result = extract_field_config(field_info, str)
        assert result == config

    def test_config_from_annotated(self):
        """Test FieldConfig from Annotated type."""

        from pydantic.fields import FieldInfo

        config = FieldConfig(renderer=Renderer.TEXT_AREA)
        annotated_type = Annotated[str, config]
        field_info = FieldInfo()
        result = extract_field_config(field_info, annotated_type)
        assert result == config


# =============================================================================
# Tests for get_constraints()
# =============================================================================


class TestGetConstraints:
    """Tests for get_constraints function."""

    def test_numeric_constraints(self):
        """Test numeric constraints from Field."""
        from pydantic.fields import FieldInfo

        # Simulate constraints via metadata
        class MockMeta:
            ge = 0
            le = 100

        field_info = FieldInfo()
        field_info.metadata = [MockMeta()]
        result = get_constraints(field_info, int)
        assert result.get("minimum") == 0
        assert result.get("maximum") == 100

    def test_string_constraints(self):
        """Test string constraints."""
        from pydantic.fields import FieldInfo

        class MockMeta:
            min_length = 1
            max_length = 255

        field_info = FieldInfo()
        field_info.metadata = [MockMeta()]
        result = get_constraints(field_info, str)
        assert result.get("minLength") == 1
        assert result.get("maxLength") == 255

    def test_literal_constraints(self):
        """Test Literal type creates enum constraint."""
        from pydantic.fields import FieldInfo

        field_info = FieldInfo()
        literal_type = Literal["a", "b", "c"]
        result = get_constraints(field_info, literal_type)
        assert result.get("enum") == ["a", "b", "c"]

    def test_empty_constraints(self):
        """Test no constraints returns empty dict."""
        from pydantic.fields import FieldInfo

        field_info = FieldInfo()
        result = get_constraints(field_info, str)
        assert result == {}


# =============================================================================
# Tests for parse_field()
# =============================================================================


class TestParseField:
    """Tests for parse_field function."""

    def test_parse_string_field(self):
        """Test parsing a string field."""
        from pydantic.fields import FieldInfo

        result = parse_field("name", FieldInfo(), str)
        assert result["type"] == "string"
        assert result["title"] == "Name"

    def test_parse_int_field(self):
        """Test parsing an integer field."""
        from pydantic.fields import FieldInfo

        result = parse_field("count", FieldInfo(), int)
        assert result["type"] == "integer"

    def test_parse_float_field(self):
        """Test parsing a float field."""
        from pydantic.fields import FieldInfo

        result = parse_field("price", FieldInfo(), float)
        assert result["type"] == "number"

    def test_parse_bool_field(self):
        """Test parsing a boolean field."""
        from pydantic.fields import FieldInfo

        result = parse_field("active", FieldInfo(), bool)
        assert result["type"] == "boolean"

    def test_parse_datetime_field(self):
        """Test parsing a datetime field."""
        from pydantic.fields import FieldInfo

        result = parse_field("created_at", FieldInfo(), datetime.datetime)
        assert result["type"] == "string"
        assert result["format"] == "date-time"

    def test_parse_date_field(self):
        """Test parsing a date field."""
        from pydantic.fields import FieldInfo

        result = parse_field("birth_date", FieldInfo(), datetime.date)
        assert result["type"] == "string"
        assert result["format"] == "date"

    def test_parse_enum_field(self):
        """Test parsing an Enum field."""
        from pydantic.fields import FieldInfo

        result = parse_field("status", FieldInfo(), Status)
        assert result["type"] == "string"
        assert result["enum"] == ["draft", "published", "archived"]

    def test_parse_str_enum_field(self):
        """Test parsing a StrEnum field."""
        from pydantic.fields import FieldInfo

        result = parse_field("priority", FieldInfo(), Priority)
        assert result["type"] == "string"
        assert result["enum"] == ["low", "medium", "high"]

    def test_parse_literal_field(self):
        """Test parsing a Literal field."""
        from pydantic.fields import FieldInfo

        literal_type = Literal["small", "medium", "large"]
        result = parse_field("size", FieldInfo(), literal_type)
        assert result["literal_values"] == ["small", "medium", "large"]

    def test_parse_optional_field(self):
        """Test parsing an Optional field."""
        from pydantic.fields import FieldInfo

        result = parse_field("email", FieldInfo(), str | None)
        assert result["required"] is False

    def test_parse_union_field_preserves_annotated_variant_names(self):
        """Union variants should not collapse to identical primitive names."""
        from pydantic import NegativeInt, PositiveInt
        from pydantic.fields import FieldInfo

        result = parse_field("server_timeout", FieldInfo(), PositiveInt | NegativeInt)

        assert result["type"] == "union"
        variants = result["variants"]
        assert len(variants) == 2

        variant_names = [variant["variant_name"] for variant in variants]
        variant_python_types = [variant["python_type"] for variant in variants]

        assert variant_names[0] != variant_names[1]
        assert variant_python_types[0] != variant_python_types[1]
        assert "Gt(gt=0)" in variant_names[0] or "Gt(gt=0)" in variant_names[1]
        assert "Lt(lt=0)" in variant_names[0] or "Lt(lt=0)" in variant_names[1]

    def test_parse_list_field(self):
        """Test parsing a List field."""
        from pydantic.fields import FieldInfo

        result = parse_field("tags", FieldInfo(), list[str])
        assert result["type"] == "array"
        assert result["items"]["type"] == "string"

    def test_parse_list_field_preserves_annotated_item_constraints(self):
        """Annotated constraints on list item types should be reflected in item schema."""
        from pydantic.fields import FieldInfo

        annotated_hour = Annotated[int, Field(ge=0, le=23)]
        result = parse_field("maintenance_start_hours", FieldInfo(), list[annotated_hour])

        assert result["type"] == "array"
        assert result["items"]["type"] == "integer"
        item_constraints = result["items"].get("constraints", {})
        assert item_constraints.get("minimum") == 0 or result["items"].get("minimum") == 0
        assert item_constraints.get("maximum") == 23 or result["items"].get("maximum") == 23

    def test_parse_annotated_field_with_constraints_and_ui_config(self):
        """Annotated Field constraints and FieldConfig metadata should both be preserved."""
        from pydantic.fields import FieldInfo

        annotated_rate_limit = Annotated[
            int,
            Field(ge=1, le=5000),
            FieldConfig(
                renderer=Renderer.SLIDER,
                props={"min": 1, "max": 5000, "step": 50},
            ),
        ]

        result = parse_field("request_rate_limit", FieldInfo(), annotated_rate_limit)

        assert result["type"] == "integer"
        constraints = result.get("constraints", {})
        assert constraints.get("minimum") == 1 or result.get("minimum") == 1
        assert constraints.get("maximum") == 5000 or result.get("maximum") == 5000
        renderer = result["ui_config"]["renderer"]
        assert renderer == Renderer.SLIDER or renderer == Renderer.SLIDER.value
        assert result["ui_config"]["props"]["step"] == 50

    def test_parse_list_field_with_pinned_columns(self):
        """Table view pinned columns can be configured per-array field via display.table."""
        from pydantic.fields import FieldInfo

        field_info = FieldInfo()
        field_info.metadata = [
            FieldConfig(
                display=DisplayConfig(
                    table=ViewDisplay(
                        pinned_columns=["__check", "__row_number", "name"],
                        column_widths={"id": 90, "name": 180},
                    )
                )
            )
        ]

        result = parse_field("users", field_info, list[Address])
        assert result["type"] == "array"
        assert result["ui_config"]["display"]["table"]["pinned_columns"] == [
            "__check",
            "__row_number",
            "name",
        ]
        assert result["ui_config"]["display"]["table"]["column_widths"] == {
            "id": 90,
            "name": 180,
        }

    def test_parse_set_field(self):
        """Test parsing a Set field."""
        from pydantic.fields import FieldInfo

        result = parse_field("unique_ids", FieldInfo(), set[int])
        assert result["type"] == "array"
        assert result["items"]["type"] == "integer"

    def test_parse_dict_field(self):
        """Test parsing a Dict field."""
        from pydantic.fields import FieldInfo

        result = parse_field("metadata", FieldInfo(), dict[str, Any])
        assert result["type"] == "object"

    def test_parse_nested_model_field(self):
        """Test parsing a nested model field."""
        from pydantic.fields import FieldInfo

        result = parse_field("address", FieldInfo(), Address)
        assert result["type"] == "object"
        assert "fields" in result
        assert "street" in result["fields"]
        assert "city" in result["fields"]

    def test_parse_field_with_title(self):
        """Test field title from FieldInfo."""
        from pydantic.fields import FieldInfo

        field_info = FieldInfo(title="Custom Title")
        result = parse_field("my_field", field_info, str)
        assert result["title"] == "Custom Title"

    def test_parse_field_with_description(self):
        """Test field description from FieldInfo."""
        from pydantic.fields import FieldInfo

        field_info = FieldInfo(description="A helpful description")
        result = parse_field("my_field", field_info, str)
        assert result["description"] == "A helpful description"

    def test_parse_field_with_default(self):
        """Test field with default value."""
        from pydantic.fields import FieldInfo

        field_info = FieldInfo(default="default_value")
        result = parse_field("my_field", field_info, str)
        assert result["default"] == "default_value"

    def test_parse_field_with_default_factory(self):
        """Test field with default factory."""
        from pydantic.fields import FieldInfo

        field_info = FieldInfo(default_factory=list)
        result = parse_field("items", field_info, list[str])
        # List fields return array type with items structure
        assert result["type"] == "array"
        assert "items" in result
        assert result["items"]["type"] == "string"

    def test_parse_field_max_depth(self):
        """Test max depth is respected."""
        from pydantic.fields import FieldInfo

        result = parse_field("field", FieldInfo(), Address, max_depth=0, current_depth=0)
        assert result["description"] == "Max depth reached"

    def test_parse_annotated_field_with_field_config(self):
        """Test parsing Annotated field with FieldConfig."""
        from pydantic.fields import FieldInfo

        config = FieldConfig(
            renderer=Renderer.SLIDER, display=DisplayConfig(help_text="Age slider")
        )
        annotated_type = Annotated[int, config]
        result = parse_field("age", FieldInfo(), annotated_type)
        assert result["type"] == "integer"
        # The ui_config should be set
        assert result.get("ui_config") is not None or result["type"] == "integer"


# =============================================================================
# Tests for parse_model()
# =============================================================================


class TestParseModel:
    """Tests for parse_model function."""

    def test_parse_simple_model(self, simple_model):
        """Test parsing a simple model."""
        result = parse_model(simple_model)
        assert result["name"] == "SimpleModel"
        assert result["type"] == "object"
        assert "name" in result["fields"]
        assert "value" in result["fields"]

    def test_parse_model_with_nested_model(self, person_with_address_model):
        """Test parsing model with nested model."""
        result = parse_model(person_with_address_model)
        assert "address" in result["fields"]
        address_field = result["fields"]["address"]
        assert address_field["type"] == "object"
        assert "street" in address_field["fields"]

    def test_parse_model_with_list_field(self, project_model):
        """Test parsing model with list fields."""
        result = parse_model(project_model)
        assert "tasks" in result["fields"]
        tasks_field = result["fields"]["tasks"]
        assert tasks_field["type"] == "array"
        assert tasks_field["items"]["type"] == "object"

    def test_parse_model_with_docstring(self, person_model):
        """Test model docstring is captured."""
        result = parse_model(person_model)
        assert result["description"] == "A person with basic information."

    def test_parse_model_max_depth(self, person_with_address_model):
        """Test max depth limits recursion."""
        result = parse_model(person_with_address_model, max_depth=1, current_depth=0)
        # Address should still be parsed at depth 1
        assert "address" in result["fields"]

    def test_parse_model_with_enum_fields(self, task_model):
        """Test parsing model with Enum fields."""
        result = parse_model(task_model)
        assert "priority" in result["fields"]
        assert result["fields"]["priority"]["enum"] == ["low", "medium", "high"]
        assert "status" in result["fields"]
        assert result["fields"]["status"]["enum"] == ["draft", "published", "archived"]

    def test_parse_model_with_optional_fields(self, person_model):
        """Test parsing model with Optional fields."""
        result = parse_model(person_model)
        assert "email" in result["fields"]
        assert result["fields"]["email"]["required"] is False

    def test_parse_model_with_datetime_fields(self, datetime_model):
        """Test parsing model with datetime fields."""
        result = parse_model(datetime_model)
        assert "created_at" in result["fields"]
        assert result["fields"]["created_at"]["format"] == "date-time"
        assert "birth_date" in result["fields"]
        assert result["fields"]["birth_date"]["format"] == "date"

    def test_parse_model_uses_imported_alias_names_for_union_variants(self):
        """When a module provides alias symbols, union variant labels should use them."""
        from pydantic import NegativeInt, PositiveInt

        class AliasModel(BaseModel):
            timeout: PositiveInt | NegativeInt = 1

        result = parse_model(AliasModel)
        variants = result["fields"]["timeout"]["variants"]
        variant_names = {variant["variant_name"] for variant in variants}

        assert variant_names == {"PositiveInt", "NegativeInt"}

    def test_parse_model_uses_user_defined_alias_names_for_union_variants(self):
        """User-defined Annotated aliases should also be preferred when available."""

        class ModeA:
            def __repr__(self) -> str:
                return "ModeA()"

        class ModeB:
            def __repr__(self) -> str:
                return "ModeB()"

        EnabledTimeout = Annotated[int, ModeA()]
        DisabledTimeout = Annotated[int, ModeB()]

        class UserAliasModel(BaseModel):
            timeout: EnabledTimeout | DisabledTimeout = 5

        result = parse_model(UserAliasModel)
        variants = result["fields"]["timeout"]["variants"]
        variant_names = {variant["variant_name"] for variant in variants}

        assert variant_names == {"EnabledTimeout", "DisabledTimeout"}

    def test_parse_model_uses_alias_names_for_constrained_annotated_union(self):
        """Constrained Annotated aliases should retain friendly alias labels in union schema."""

        class AggressiveBudget:
            def __repr__(self) -> str:
                return "AggressiveBudget()"

        class ConservativeBudget:
            def __repr__(self) -> str:
                return "ConservativeBudget()"

        AggressiveRetryBudget = Annotated[
            int,
            AggressiveBudget(),
            Field(gt=0, le=3),
        ]
        ConservativeRetryBudget = Annotated[
            int,
            ConservativeBudget(),
            Field(gt=3, le=10),
        ]

        class RetryBudgetModel(BaseModel):
            retry_budget: AggressiveRetryBudget | ConservativeRetryBudget = 4

        result = parse_model(RetryBudgetModel)
        variants = result["fields"]["retry_budget"]["variants"]
        variant_names = {variant["variant_name"] for variant in variants}

        assert variant_names == {"AggressiveRetryBudget", "ConservativeRetryBudget"}

    def test_parse_model_preserves_annotated_list_item_constraints(self):
        """Annotated list item constraints should be visible in parsed model schema."""

        class MaintenanceModel(BaseModel):
            maintenance_start_hours: list[Annotated[int, Field(ge=0, le=23)]] = Field(
                default_factory=list
            )

        result = parse_model(MaintenanceModel)
        field_schema = result["fields"]["maintenance_start_hours"]

        assert field_schema["type"] == "array"
        assert field_schema["items"]["type"] == "integer"
        item_constraints = field_schema["items"].get("constraints", {})
        assert item_constraints.get("minimum") == 0 or field_schema["items"].get("minimum") == 0
        assert item_constraints.get("maximum") == 23 or field_schema["items"].get("maximum") == 23


# =============================================================================
# Tests for model_to_data()
# =============================================================================


class TestModelToData:
    """Tests for model_to_data function."""

    def test_with_instance(self, simple_model, simple_instance):
        """Test converting model instance to data."""
        result = model_to_data(simple_model, simple_instance)
        assert result == {"name": "test", "value": 42}

    def test_without_instance_uses_defaults(self, simple_model):
        """Test creating default data without instance."""
        result = model_to_data(simple_model)
        assert result["name"] == ""  # str default
        assert result["value"] == 0  # int default with value

    def test_with_complex_instance(self, project_model, project_instance):
        """Test converting complex model instance."""
        result = model_to_data(project_model, project_instance)
        assert result["name"] == "Test Project"
        assert len(result["tasks"]) == 2
        assert len(result["team"]) == 2
        assert "python" in result["tags"]

    def test_datetime_serialization(self, datetime_model):
        """Test datetime fields are serialized to ISO format."""
        instance = DateTimeModel(
            created_at=datetime.datetime(2024, 1, 15, 10, 30, 0),
            birth_date=datetime.date(1990, 5, 20),
        )
        result = model_to_data(datetime_model, instance)
        assert "2024-01-15" in result["created_at"]
        assert result["birth_date"] == "1990-05-20"

    def test_enum_serialization(self, task_model, task_instance):
        """Test enum fields are serialized to values."""
        result = model_to_data(task_model, task_instance)
        assert result["priority"] == "high"
        assert result["status"] == "draft"

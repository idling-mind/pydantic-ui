"""Unit tests for Union and Discriminated Union schema parsing."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from pydantic_ui.schema import (
    extract_discriminator,
    get_discriminator_values,
    get_variant_name,
    parse_field,
    parse_model,
    parse_union_field,
)


# Test models for discriminated unions
class Cat(BaseModel):
    pet_type: Literal["cat"] = "cat"
    name: str = "Whiskers"
    meows: int = 5


class Dog(BaseModel):
    pet_type: Literal["dog"] = "dog"
    name: str = "Buddy"
    barks: float = 3.5


class Lizard(BaseModel):
    pet_type: Literal["reptile", "lizard"] = "lizard"
    name: str = "Scales"


# Test models for simple unions
class Circle(BaseModel):
    radius: float = 5.0


class Rectangle(BaseModel):
    width: float = 10.0
    height: float = 5.0


class TestExtractDiscriminator:
    """Tests for extract_discriminator function."""

    def test_string_discriminator(self):
        """Test extraction of string discriminator from Field."""
        field_info = Field(discriminator="pet_type")
        result = extract_discriminator(field_info)

        assert result is not None
        assert result["field"] == "pet_type"
        assert result["type"] == "string"

    def test_no_discriminator(self):
        """Test that None is returned when no discriminator is set."""
        field_info = Field(default=None)
        result = extract_discriminator(field_info)

        assert result is None

    def test_discriminator_in_metadata(self):
        """Test extraction from Annotated metadata."""
        # This tests the metadata path
        field_info = Field(default=None)
        field_info.metadata = [Field(discriminator="type")]

        result = extract_discriminator(field_info)
        assert result is not None
        assert result["field"] == "type"


class TestGetDiscriminatorValues:
    """Tests for get_discriminator_values function."""

    def test_single_literal_value(self):
        """Test extracting single literal discriminator value."""
        values = get_discriminator_values(Cat, "pet_type")
        assert values == ["cat"]

    def test_multiple_literal_values(self):
        """Test extracting multiple literal discriminator values."""
        values = get_discriminator_values(Lizard, "pet_type")
        assert set(values) == {"reptile", "lizard"}

    def test_missing_field(self):
        """Test behavior when discriminator field doesn't exist."""
        values = get_discriminator_values(Cat, "nonexistent")
        assert values == []

    def test_non_model_type(self):
        """Test behavior with non-BaseModel type."""
        values = get_discriminator_values(str, "any_field")  # type: ignore
        assert values == []


class TestGetVariantName:
    """Tests for get_variant_name function."""

    def test_model_with_name(self):
        """Test getting name from a model class."""
        name = get_variant_name(Cat)
        assert name == "Cat"

    def test_primitive_type(self):
        """Test getting name from primitive type."""
        name = get_variant_name(str)
        assert name == "str"

        name = get_variant_name(int)
        assert name == "int"


class TestParseUnionField:
    """Tests for parse_union_field function."""

    def test_optional_type(self):
        """Test that Optional[T] is handled correctly (single type + None)."""
        field_info = Field(default=None)
        result = parse_union_field(
            "optional_str",
            field_info,
            (str, type(None)),
            max_depth=10,
            current_depth=0,
        )

        # Should be parsed as the inner type, not as union
        assert result["type"] == "string"
        assert result["required"] is False

    def test_discriminated_union(self):
        """Test parsing of discriminated union with multiple model variants."""
        field_info = Field(discriminator="pet_type")
        result = parse_union_field(
            "pet",
            field_info,
            (Cat, Dog, Lizard),
            max_depth=10,
            current_depth=0,
        )

        assert result["type"] == "union"
        assert len(result["variants"]) == 3
        assert result["discriminator"] is not None
        assert result["discriminator"]["field"] == "pet_type"

        # Check discriminator mapping
        mapping = result["discriminator"]["mapping"]
        assert mapping is not None
        assert mapping["cat"] == 0  # Cat is first variant
        assert mapping["dog"] == 1  # Dog is second variant
        assert mapping["reptile"] == 2  # Lizard is third
        assert mapping["lizard"] == 2  # Lizard maps to same index

    def test_simple_union(self):
        """Test parsing of union without discriminator."""
        field_info = Field(default=None)
        result = parse_union_field(
            "shape",
            field_info,
            (Circle, Rectangle),
            max_depth=10,
            current_depth=0,
        )

        assert result["type"] == "union"
        assert len(result["variants"]) == 2
        # No discriminator should be set
        assert result.get("discriminator") is None

    def test_primitive_union(self):
        """Test parsing of union with primitive types."""
        field_info = Field(default="default")
        result = parse_union_field(
            "id",
            field_info,
            (str, int),
            max_depth=10,
            current_depth=0,
        )

        assert result["type"] == "union"
        assert len(result["variants"]) == 2

        # Check variant types
        variant_types = [v["type"] for v in result["variants"]]
        assert "string" in variant_types
        assert "integer" in variant_types

    def test_optional_union(self):
        """Test parsing of Optional[Union[A, B]] (union with None)."""
        field_info = Field(default=None)
        result = parse_union_field(
            "optional_pet",
            field_info,
            (Cat, Dog, type(None)),
            max_depth=10,
            current_depth=0,
        )

        assert result["type"] == "union"
        assert len(result["variants"]) == 2  # None should be excluded
        assert result["required"] is False


class TestParseField:
    """Tests for parse_field function with Union types."""

    def test_union_type_detected(self):
        """Test that Union types are properly detected and parsed."""
        field_info = Field(default=None)
        result = parse_field(
            "shape",
            field_info,
            Circle | Rectangle,
            max_depth=10,
            current_depth=0,
        )

        assert result["type"] == "union"
        assert "variants" in result

    def test_annotated_union_with_discriminator(self):
        """Test Annotated Union with discriminator field."""

        class TestModel(BaseModel):
            pet: Annotated[
                Cat | Dog,
                Field(discriminator="pet_type")
            ]

        schema = parse_model(TestModel)
        pet_field = schema["fields"]["pet"]

        assert pet_field["type"] == "union"
        assert pet_field["discriminator"] is not None
        assert pet_field["discriminator"]["field"] == "pet_type"


class TestParseModel:
    """Tests for parse_model function with Union fields."""

    def test_model_with_union_field(self):
        """Test parsing a model that contains a union field."""

        class Config(BaseModel):
            name: str = "test"
            pet: Cat | Dog = Field(default_factory=Cat)

        schema = parse_model(Config)

        assert "name" in schema["fields"]
        assert "pet" in schema["fields"]

        pet_schema = schema["fields"]["pet"]
        assert pet_schema["type"] == "union"
        assert len(pet_schema["variants"]) == 2

    def test_model_with_discriminated_union(self):
        """Test parsing a model with discriminated union field."""

        class Config(BaseModel):
            pet: Annotated[
                Cat | Dog | Lizard,
                Field(discriminator="pet_type")
            ]

        schema = parse_model(Config)
        pet_schema = schema["fields"]["pet"]

        assert pet_schema["type"] == "union"
        assert pet_schema["discriminator"]["field"] == "pet_type"
        assert len(pet_schema["discriminator"]["mapping"]) == 4  # cat, dog, reptile, lizard

    def test_model_with_array_of_unions(self):
        """Test parsing a model with an array of union items."""

        class Config(BaseModel):
            pets: list[Cat | Dog] = Field(default_factory=list)

        schema = parse_model(Config)
        pets_schema = schema["fields"]["pets"]

        assert pets_schema["type"] == "array"
        assert pets_schema["items"]["type"] == "union"
        assert len(pets_schema["items"]["variants"]) == 2


class TestVariantSchema:
    """Tests for variant schema structure."""

    def test_variant_has_required_fields(self):
        """Test that each variant has the required metadata."""
        field_info = Field(default=None)
        result = parse_union_field(
            "pet",
            field_info,
            (Cat, Dog),
            max_depth=10,
            current_depth=0,
        )

        for i, variant in enumerate(result["variants"]):
            assert "variant_index" in variant
            assert variant["variant_index"] == i
            assert "variant_name" in variant
            assert variant["variant_name"] in ["Cat", "Dog"]

    def test_variant_includes_model_fields(self):
        """Test that variant schemas include the model's fields."""
        field_info = Field(default=None)
        result = parse_union_field(
            "pet",
            field_info,
            (Cat,),  # Single variant that will be treated as optional
            max_depth=10,
            current_depth=0,
        )

        # Single type in union is treated as optional, not union
        # Let's use two types
        result = parse_union_field(
            "pet",
            field_info,
            (Cat, Dog),
            max_depth=10,
            current_depth=0,
        )

        cat_variant = result["variants"][0]
        assert cat_variant["type"] == "object"
        assert "fields" in cat_variant
        assert "name" in cat_variant["fields"]
        assert "meows" in cat_variant["fields"]

    def test_discriminator_values_in_variant(self):
        """Test that discriminator values are included in variant schema."""
        field_info = Field(discriminator="pet_type")
        result = parse_union_field(
            "pet",
            field_info,
            (Cat, Dog, Lizard),
            max_depth=10,
            current_depth=0,
        )

        cat_variant = result["variants"][0]
        assert "discriminator_values" in cat_variant
        assert cat_variant["discriminator_values"] == ["cat"]

        lizard_variant = result["variants"][2]
        assert set(lizard_variant["discriminator_values"]) == {"reptile", "lizard"}

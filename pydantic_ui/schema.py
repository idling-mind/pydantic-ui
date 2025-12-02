"""Schema parser for converting Pydantic models to UI schema format."""

from typing import Any, Union, get_args, get_origin

from pydantic import BaseModel
from pydantic.fields import FieldInfo
from pydantic_core import PydanticUndefined

from pydantic_ui.config import FieldConfig, Renderer


def get_json_type(python_type: type) -> str:
    """Convert Python type to JSON schema type."""
    type_map = {
        str: "string",
        int: "integer",
        float: "number",
        bool: "boolean",
        list: "array",
        dict: "object",
        set: "array",
        tuple: "array",
    }

    # Handle None type
    if python_type is type(None):
        return "null"

    # Check direct mapping
    if python_type in type_map:
        return type_map[python_type]

    # Check for subclasses
    for py_type, json_type in type_map.items():
        if isinstance(python_type, type) and issubclass(python_type, py_type):
            return json_type

    return "string"


def extract_field_config(field_info: FieldInfo, field_type: type) -> FieldConfig | None:
    """Extract FieldConfig from Annotated metadata."""
    # Check field_info metadata
    if field_info.metadata:
        for meta in field_info.metadata:
            if isinstance(meta, FieldConfig):
                return meta

    # Check Annotated args
    origin = get_origin(field_type)
    if origin is not None:
        args = get_args(field_type)
        for arg in args:
            if isinstance(arg, FieldConfig):
                return arg

    return None


def get_constraints(field_info: FieldInfo, field_type: type) -> dict[str, Any]:
    """Extract constraints from field info and type annotations."""
    constraints: dict[str, Any] = {}

    # Extract from field_info metadata
    if field_info.metadata:
        for meta in field_info.metadata:
            if hasattr(meta, "gt"):
                constraints["exclusiveMinimum"] = meta.gt
            if hasattr(meta, "ge"):
                constraints["minimum"] = meta.ge
            if hasattr(meta, "lt"):
                constraints["exclusiveMaximum"] = meta.lt
            if hasattr(meta, "le"):
                constraints["maximum"] = meta.le
            if hasattr(meta, "min_length"):
                constraints["minLength"] = meta.min_length
            if hasattr(meta, "max_length"):
                constraints["maxLength"] = meta.max_length
            if hasattr(meta, "pattern"):
                constraints["pattern"] = meta.pattern
            if hasattr(meta, "multiple_of"):
                constraints["multipleOf"] = meta.multiple_of

    # Check for Literal types (enum values)
    origin = get_origin(field_type)
    from typing import Literal

    if origin is Literal:
        constraints["enum"] = list(get_args(field_type))

    return constraints


def parse_field(
    name: str,
    field_info: FieldInfo,
    field_type: type,
    max_depth: int = 10,
    current_depth: int = 0,
) -> dict[str, Any]:
    """Parse a single field to schema format."""
    if current_depth >= max_depth:
        return {"type": "string", "title": name, "description": "Max depth reached"}

    origin = get_origin(field_type)
    args = get_args(field_type)

    # Handle Annotated types - unwrap to get the actual type
    from typing import Annotated

    if origin is Annotated:
        actual_type = args[0]
        return parse_field(name, field_info, actual_type, max_depth, current_depth)

    # Handle Optional (Union with None)
    if origin is Union:
        non_none = [a for a in args if a is not type(None)]
        if len(non_none) == 1:
            result = parse_field(name, field_info, non_none[0], max_depth, current_depth)
            result["required"] = False
            return result
        # Handle Union of multiple types - use first non-None type
        if non_none:
            result = parse_field(name, field_info, non_none[0], max_depth, current_depth)
            result["required"] = False
            return result

    # Handle List/Set/Tuple
    if origin in (list, set, tuple):
        item_type = args[0] if args else str
        return {
            "type": "array",
            "title": field_info.title or name.replace("_", " ").title(),
            "description": field_info.description,
            "required": True,
            "items": parse_field("item", FieldInfo(), item_type, max_depth, current_depth + 1),
        }

    # Handle Dict
    if origin is dict:
        value_type = args[1] if len(args) > 1 else Any
        return {
            "type": "object",
            "title": field_info.title or name.replace("_", " ").title(),
            "description": field_info.description,
            "required": True,
            "additionalProperties": parse_field(
                "value", FieldInfo(), value_type, max_depth, current_depth + 1
            ),
        }

    # Handle nested Pydantic models
    if isinstance(field_type, type) and issubclass(field_type, BaseModel):
        return parse_model(field_type, max_depth, current_depth + 1)

    # Extract field config
    field_config = extract_field_config(field_info, field_type)
    ui_config = None
    if field_config:
        ui_config = {
            "renderer": (
                field_config.renderer.value
                if isinstance(field_config.renderer, Renderer)
                else field_config.renderer
            ),
            "label": field_config.label,
            "placeholder": field_config.placeholder,
            "help_text": field_config.help_text,
            "hidden": field_config.hidden,
            "read_only": field_config.read_only,
            "props": field_config.props,
        }

    # Primitive types
    default_value = None
    if field_info.default is not PydanticUndefined:
        default_value = field_info.default
    elif field_info.default_factory is not None:
        try:
            default_value = field_info.default_factory()
        except Exception:
            pass

    return {
        "type": get_json_type(field_type),
        "title": field_info.title or name.replace("_", " ").title(),
        "description": field_info.description,
        "required": field_info.is_required(),
        "default": default_value,
        "constraints": get_constraints(field_info, field_type),
        "ui_config": ui_config,
    }


def parse_model(
    model: type[BaseModel],
    max_depth: int = 10,
    current_depth: int = 0,
) -> dict[str, Any]:
    """Convert Pydantic model to UI schema format."""
    if current_depth >= max_depth:
        return {
            "name": model.__name__,
            "type": "object",
            "description": "Max depth reached",
            "fields": {},
        }

    fields = {}
    for field_name, field_info in model.model_fields.items():
        field_type = field_info.annotation
        if field_type is None:
            field_type = str

        fields[field_name] = parse_field(
            field_name,
            field_info,
            field_type,
            max_depth,
            current_depth,
        )

    return {
        "name": model.__name__,
        "type": "object",
        "description": model.__doc__,
        "fields": fields,
    }


def model_to_data(model: type[BaseModel], instance: BaseModel | None = None) -> dict[str, Any]:
    """Convert a Pydantic model instance to the nested data format for the UI."""
    if instance is not None:
        return instance.model_dump(mode="json", warnings=False)

    # Create default instance
    try:
        default_instance = model()
        return default_instance.model_dump(mode="json", warnings=False)
    except Exception:
        # Build default data from field defaults
        data = {}
        for field_name, field_info in model.model_fields.items():
            if field_info.default is not PydanticUndefined:
                data[field_name] = field_info.default
            elif field_info.default_factory is not None:
                try:
                    data[field_name] = field_info.default_factory()
                except Exception:
                    data[field_name] = None
            else:
                data[field_name] = None
        return data

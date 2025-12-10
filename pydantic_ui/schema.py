"""Schema parser for converting Pydantic models to UI schema format."""

import datetime
import types
from enum import Enum
from typing import Any, Literal, Union, get_args, get_origin

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

    # Handle datetime types
    if python_type in (datetime.datetime, datetime.date, datetime.time):
        return "string"

    # Handle Enum types (including StrEnum)
    if isinstance(python_type, type) and issubclass(python_type, Enum):
        return "string"

    # Check direct mapping
    if python_type in type_map:
        return type_map[python_type]

    # Check for subclasses
    for py_type, json_type in type_map.items():
        if isinstance(python_type, type) and issubclass(python_type, py_type):
            return json_type

    return "string"


def get_python_type_name(python_type: type) -> str:
    """Get a human-readable Python type name."""
    # Handle None type
    if python_type is type(None):
        return "None"

    # Handle generic types (List, Dict, etc.)
    origin = get_origin(python_type)
    if origin is not None:
        args = get_args(python_type)
        origin_name = getattr(origin, "__name__", str(origin))
        if args:
            args_str = ", ".join(get_python_type_name(arg) for arg in args)
            return f"{origin_name}[{args_str}]"
        return origin_name

    # Handle regular types
    if hasattr(python_type, "__name__"):
        return python_type.__name__

    return str(python_type)


def get_format_for_type(python_type: type) -> str | None:
    """Get JSON schema format for special types."""
    if python_type is datetime.datetime:
        return "date-time"
    if python_type is datetime.date:
        return "date"
    if python_type is datetime.time:
        return "time"
    return None


def get_enum_values(python_type: type) -> list[Any] | None:
    """Extract enum values from Enum or StrEnum types."""
    if isinstance(python_type, type) and issubclass(python_type, Enum):
        return [member.value for member in python_type]
    return None


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

    # Handle Optional (Union with None) - supports both typing.Union and types.UnionType (X | Y syntax)
    if origin is Union or origin is types.UnionType:
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

    # Handle Literal types
    if origin is Literal:
        literal_values = list(args)
        # Determine the type from the literal values
        first_value = literal_values[0] if literal_values else ""
        value_type = type(first_value).__name__
        json_type = "string"
        if isinstance(first_value, bool):
            json_type = "boolean"
        elif isinstance(first_value, int):
            json_type = "integer"
        elif isinstance(first_value, float):
            json_type = "number"

        # Build python_type string for Literal
        literal_repr = ", ".join(repr(v) for v in literal_values)
        python_type_str = f"Literal[{literal_repr}]"

        return {
            "type": json_type,
            "python_type": python_type_str,
            "title": field_info.title or name.replace("_", " ").title(),
            "description": field_info.description,
            "required": field_info.is_required(),
            "default": field_info.default if field_info.default is not PydanticUndefined else None,
            "literal_values": literal_values,
            "ui_config": None,
        }

    # Handle Enum types (including StrEnum)
    if isinstance(field_type, type) and issubclass(field_type, Enum):
        enum_values = get_enum_values(field_type)
        default_value = None
        if field_info.default is not PydanticUndefined:
            default_value = (
                field_info.default.value
                if isinstance(field_info.default, Enum)
                else field_info.default
            )

        return {
            "type": get_json_type(field_type),
            "python_type": field_type.__name__,
            "title": field_info.title or name.replace("_", " ").title(),
            "description": field_info.description,
            "required": field_info.is_required(),
            "default": default_value,
            "enum": enum_values,
            "ui_config": None,
        }

    # Handle List/Set/Tuple
    if origin in (list, set, tuple):
        item_type = args[0] if args else str
        return {
            "type": "array",
            "python_type": get_python_type_name(field_type),
            "title": field_info.title or name.replace("_", " ").title(),
            "description": field_info.description,
            "required": True,
            "items": parse_field("item", FieldInfo(), item_type, max_depth, current_depth + 1),
        }

    # Handle Dict
    if origin is dict:
        value_type = args[1] if len(args) > 1 else Any  # type: ignore
        return {
            "type": "object",
            "python_type": get_python_type_name(field_type),
            "title": field_info.title or name.replace("_", " ").title(),
            "description": field_info.description,
            "required": True,
            "additionalProperties": parse_field(
                "value",
                FieldInfo(),
                value_type,
                max_depth,
                current_depth + 1,  # type: ignore
            ),
        }

    # Handle nested Pydantic models
    if isinstance(field_type, type) and issubclass(field_type, BaseModel):
        result = parse_model(field_type, max_depth, current_depth + 1)
        # Add title from field_info if available, otherwise use field name (not model name)
        result["title"] = field_info.title or name.replace("_", " ").title()
        # Nested models are required by default unless wrapped in Optional
        result["required"] = field_info.is_required()
        result["python_type"] = field_type.__name__
        # Add description from field_info
        if field_info.description:
            result["description"] = field_info.description
        # Extract and add ui_config for nested models
        field_config = extract_field_config(field_info, field_type)
        if field_config:
            result["ui_config"] = {
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
                "visible_when": field_config.visible_when,
                "props": field_config.props,
            }
        return result

    # Handle datetime types
    format_hint = get_format_for_type(field_type)

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
            "visible_when": field_config.visible_when,
            "props": field_config.props,
        }

    # Primitive types
    default_value = None
    if field_info.default is not PydanticUndefined:
        default_value = field_info.default
        # Handle datetime defaults
        if isinstance(default_value, (datetime.datetime, datetime.date, datetime.time)):
            default_value = default_value.isoformat()
    elif field_info.default_factory is not None:
        try:
            default_value = field_info.default_factory()  # type: ignore
            # Handle datetime factory defaults
            if isinstance(default_value, (datetime.datetime, datetime.date, datetime.time)):
                default_value = default_value.isoformat()
        except Exception:
            pass

    result = {
        "type": get_json_type(field_type),
        "python_type": get_python_type_name(field_type),
        "title": field_info.title or name.replace("_", " ").title(),
        "description": field_info.description,
        "required": field_info.is_required(),
        "default": default_value,
        "constraints": get_constraints(field_info, field_type),
        "ui_config": ui_config,
    }

    # Add format for datetime types
    if format_hint:
        result["format"] = format_hint

    return result


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
                    data[field_name] = field_info.default_factory()  # type: ignore
                except Exception:
                    data[field_name] = _get_type_default(field_info.annotation)
            else:
                data[field_name] = _get_type_default(field_info.annotation)
        return data


def _get_type_default(field_type: type | None) -> Any:
    """Get a reasonable default value for a given type."""
    if field_type is None:
        return None

    origin = get_origin(field_type)

    # Handle Optional types
    if origin is Union or origin is types.UnionType:
        args = get_args(field_type)
        non_none = [a for a in args if a is not type(None)]
        if non_none:
            return _get_type_default(non_none[0])
        return None

    # Handle basic types
    if field_type is str:
        return ""
    if field_type is int:
        return 0
    if field_type is float:
        return 0.0
    if field_type is bool:
        return False
    if origin in (list, set, tuple):
        return []
    if origin is dict or field_type is dict:
        return {}

    return None

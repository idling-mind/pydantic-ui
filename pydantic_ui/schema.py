"""Schema parser for converting Pydantic models to UI schema format."""

import datetime
import types
from enum import Enum
from typing import Annotated, Any, Literal, Union, get_args, get_origin

from pydantic import BaseModel
from pydantic.fields import FieldInfo
from pydantic_core import PydanticUndefined

from pydantic_ui.config import DisplayConfig, FieldConfig, Renderer, ViewDisplay


def is_optional_type(annotation: Any) -> bool:
    """Check if the type annotation is Optional (Union with None).

    This determines if a field can accept None as a value, which is different
    from whether it has a default value. Fields with defaults but non-Optional
    types should still show as "required" in the UI.
    """
    if annotation is None:
        return True

    # Unwrap Annotated types first
    origin = get_origin(annotation)
    if origin is Annotated:
        annotation = get_args(annotation)[0]
        origin = get_origin(annotation)

    # Check for Union types (including Python 3.10+ X | Y syntax)
    if origin is Union or origin is types.UnionType:
        args = get_args(annotation)
        return type(None) in args

    return False


def build_ui_config(field_config: FieldConfig) -> dict[str, Any]:
    """Build the ui_config dict from a FieldConfig."""
    return {
        "renderer": (
            field_config.renderer.value
            if isinstance(field_config.renderer, Renderer)
            else field_config.renderer
        ),
        "display": field_config.display.model_dump() if field_config.display else None,
        "placeholder": field_config.placeholder,
        "hidden": field_config.hidden,
        "read_only": field_config.read_only,
        "visible_when": field_config.visible_when,
        "options_from": field_config.options_from,
        "props": field_config.props,
    }


def extract_discriminator(field_info: FieldInfo) -> dict[str, Any] | None:
    """Extract discriminator information from field info.

    Handles both string discriminators (field name) and Pydantic Discriminator objects.
    Returns dict with 'field' key if discriminator found, None otherwise.
    """
    # Check if discriminator is set directly on the field
    discriminator = getattr(field_info, "discriminator", None)

    if discriminator is None and field_info.metadata:
        # Check metadata for Field with discriminator
        for meta in field_info.metadata:
            if hasattr(meta, "discriminator") and meta.discriminator is not None:
                discriminator = meta.discriminator
                break

    if discriminator is None:
        return None

    # Handle string discriminator (field name)
    if isinstance(discriminator, str):
        return {"field": discriminator, "type": "string"}

    # Handle Pydantic Discriminator object (callable discriminator)
    # For callable discriminators, we can't easily extract the logic,
    # but we can still provide the schema structure
    if callable(discriminator):
        return {"field": None, "type": "callable", "callable": str(discriminator)}

    # Handle Discriminator class instance
    if hasattr(discriminator, "discriminator"):
        inner = discriminator.discriminator
        if isinstance(inner, str):
            return {"field": inner, "type": "string"}
        elif callable(inner):
            return {"field": None, "type": "callable", "callable": str(inner)}

    return None


def get_discriminator_values(variant_type: type, discriminator_field: str) -> list[Any]:
    """Extract discriminator values from a variant type.

    For Pydantic models, looks for Literal type annotations on the discriminator field.
    """
    if not isinstance(variant_type, type):
        return []

    if not issubclass(variant_type, BaseModel):
        return []

    # Check if the model has the discriminator field
    if discriminator_field not in variant_type.model_fields:
        return []

    field_info = variant_type.model_fields[discriminator_field]
    field_type = field_info.annotation

    if field_type is None:
        return []

    # Handle Annotated types
    origin = get_origin(field_type)
    if origin is Annotated:
        field_type = get_args(field_type)[0]
        origin = get_origin(field_type)

    # Check for Literal type
    if origin is Literal:
        return list(get_args(field_type))

    # Check for default value
    if field_info.default is not PydanticUndefined:
        return [field_info.default]

    return []


def get_variant_name(variant_type: type) -> str:
    """Get a display name for a union variant.

    For generic types like list[Person], returns the full type name (e.g., "list[Person]")
    to enable proper matching with attr_configs paths.
    """
    # Handle generic types (List, Dict, etc.) to get full name like "list[Person]"
    origin = get_origin(variant_type)
    if origin is not None:
        args = get_args(variant_type)
        origin_name = getattr(origin, "__name__", str(origin))
        if args:
            args_str = ", ".join(get_python_type_name(arg) for arg in args)
            return f"{origin_name}[{args_str}]"
        return origin_name

    # Handle regular types
    if hasattr(variant_type, "__name__"):
        return variant_type.__name__
    return str(variant_type)


def get_python_type_name_for_union(types_list: list[type]) -> str:
    """Generate a Python type name string for a union of types."""
    type_names = [get_python_type_name(t) for t in types_list]
    return f"Union[{', '.join(type_names)}]"


def is_pydantic_model(t: type) -> bool:
    """Check if a type is a Pydantic BaseModel subclass."""
    try:
        return isinstance(t, type) and issubclass(t, BaseModel)
    except TypeError:
        return False


def parse_union_field(
    name: str,
    field_info: FieldInfo,
    union_args: tuple[type, ...],
    max_depth: int,
    current_depth: int,
    class_configs: dict[str, FieldConfig] | None = None,
) -> dict[str, Any]:
    """Parse a Union type field, handling discriminated unions.

    Returns a schema with type='union' containing variants array and optional discriminator.
    """
    non_none = [a for a in union_args if a is not type(None)]
    has_none = len(non_none) < len(union_args)

    # Single type + None = Optional, handle normally
    if len(non_none) == 1:
        single_result = parse_field(
            name, field_info, non_none[0], max_depth, current_depth, class_configs
        )
        single_result["required"] = not has_none
        return single_result

    # Check if all non-None types are primitive (not BaseModel)
    all_primitive = all(not is_pydantic_model(t) for t in non_none)

    # For primitive unions (e.g., Union[str, int]), use a simpler representation
    if all_primitive and len(non_none) <= 3:
        # Still create union schema but mark as primitive
        pass  # Fall through to full union handling for consistency

    # Extract discriminator info from field_info
    discriminator_info = extract_discriminator(field_info)

    variants = []
    discriminator_mapping: dict[str, int] = {}

    for i, variant_type in enumerate(non_none):
        # Parse the variant schema
        variant_schema = parse_field(
            f"variant_{i}",
            FieldInfo(),
            variant_type,
            max_depth,
            current_depth + 1,
            class_configs,
        )

        # Add variant metadata
        variant_schema["variant_index"] = i
        variant_schema["variant_name"] = get_variant_name(variant_type)

        # Override the auto-generated title with the actual type name
        # This ensures "Cat" instead of "Variant 0" is displayed
        variant_schema["title"] = get_variant_name(variant_type)

        # Extract discriminator values for this variant
        if discriminator_info and discriminator_info.get("field"):
            disc_field = discriminator_info["field"]
            disc_values = get_discriminator_values(variant_type, disc_field)
            variant_schema["discriminator_values"] = disc_values
            for val in disc_values:
                discriminator_mapping[str(val)] = i

        variants.append(variant_schema)

    # Build the union schema
    result: dict[str, Any] = {
        "type": "union",
        "python_type": get_python_type_name_for_union(non_none),
        "title": field_info.title or name.replace("_", " ").title(),
        "description": field_info.description,
        "required": not has_none,
        "default": field_info.default if field_info.default is not PydanticUndefined else None,
        "variants": variants,
    }

    # Add discriminator info if present
    if discriminator_info:
        result["discriminator"] = {
            "field": discriminator_info.get("field"),
            "type": discriminator_info.get("type"),
            "mapping": discriminator_mapping if discriminator_mapping else None,
        }

    # Extract field config
    field_config = extract_field_config(field_info, type(None), class_configs)
    if field_config:
        result["ui_config"] = build_ui_config(field_config)
    else:
        result["ui_config"] = None

    return result


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


def extract_field_config(
    field_info: FieldInfo,
    field_type: type,
    class_configs: dict[str, FieldConfig] | None = None,
) -> FieldConfig | None:
    """Extract FieldConfig from Annotated metadata or class configs."""
    # Check class configs first (lower priority)
    config = None
    if class_configs:
        # Handle Annotated types - unwrap to get the actual type
        actual_type = field_type
        origin = get_origin(field_type)
        if origin is Annotated:
            actual_type = get_args(field_type)[0]

        if hasattr(actual_type, "__name__") and actual_type.__name__ in class_configs:
            config = class_configs[actual_type.__name__]

    # Check field_info metadata (higher priority)
    annotated_config = None
    if field_info.metadata:
        for meta in field_info.metadata:
            if isinstance(meta, FieldConfig):
                annotated_config = meta
                break

    # Check Annotated args
    if annotated_config is None:
        origin = get_origin(field_type)
        if origin is not None:
            args = get_args(field_type)
            for arg in args:
                if isinstance(arg, FieldConfig):
                    annotated_config = arg
                    break

    if annotated_config:
        if config:
            # Merge: annotated_config overrides config
            # Start with a copy of class config
            new_config = FieldConfig(
                renderer=config.renderer,
                display=config.display,
                placeholder=config.placeholder,
                hidden=config.hidden,
                read_only=config.read_only,
                visible_when=config.visible_when,
                options_from=config.options_from,
                props=config.props.copy(),
            )

            # Apply annotated config properties that are NOT their defaults
            if annotated_config.renderer != Renderer.AUTO:
                new_config.renderer = annotated_config.renderer
            if annotated_config.display is not None:
                # Merge display configs if both exist
                if new_config.display is not None:
                    new_config.display = _merge_display_configs(
                        new_config.display, annotated_config.display
                    )
                else:
                    new_config.display = annotated_config.display
            if annotated_config.placeholder is not None:
                new_config.placeholder = annotated_config.placeholder
            if annotated_config.hidden is True:
                new_config.hidden = True
            if annotated_config.read_only is True:
                new_config.read_only = True
            if annotated_config.visible_when is not None:
                new_config.visible_when = annotated_config.visible_when
            if annotated_config.options_from is not None:
                new_config.options_from = annotated_config.options_from
            if annotated_config.props:
                new_config.props.update(annotated_config.props)

            return new_config

        return annotated_config

    return config


def _merge_display_configs(base: DisplayConfig, override: DisplayConfig) -> DisplayConfig:
    """Merge two DisplayConfig objects, with override taking precedence."""

    def merge_view(
        base_view: ViewDisplay | None, override_view: ViewDisplay | None
    ) -> ViewDisplay | None:
        if override_view is None:
            return base_view
        if base_view is None:
            return override_view
        return ViewDisplay(
            title=override_view.title if override_view.title is not None else base_view.title,
            subtitle=override_view.subtitle
            if override_view.subtitle is not None
            else base_view.subtitle,
            help_text=override_view.help_text
            if override_view.help_text is not None
            else base_view.help_text,
            icon=override_view.icon if override_view.icon is not None else base_view.icon,
        )

    return DisplayConfig(
        title=override.title if override.title is not None else base.title,
        subtitle=override.subtitle if override.subtitle is not None else base.subtitle,
        help_text=override.help_text if override.help_text is not None else base.help_text,
        tree=merge_view(base.tree, override.tree),
        detail=merge_view(base.detail, override.detail),
        table=merge_view(base.table, override.table),
        card=merge_view(base.card, override.card),
    )


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
    field_type: Any,
    max_depth: int = 10,
    current_depth: int = 0,
    class_configs: dict[str, FieldConfig] | None = None,
) -> dict[str, Any]:
    """Parse a single field to schema format."""
    if current_depth >= max_depth:
        return {"type": "string", "title": name, "description": "Max depth reached"}

    origin = get_origin(field_type)
    args = get_args(field_type)

    # Handle Annotated types - unwrap to get the actual type
    if origin is Annotated:
        actual_type = args[0]
        return parse_field(name, field_info, actual_type, max_depth, current_depth, class_configs)

    # Handle Union types - supports both typing.Union and types.UnionType (X | Y syntax)
    if origin is Union or origin is types.UnionType:
        return parse_union_field(name, field_info, args, max_depth, current_depth, class_configs)

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

        # Extract field config
        field_config = extract_field_config(field_info, field_type, class_configs)
        ui_config = build_ui_config(field_config) if field_config else None

        return {
            "type": json_type,
            "python_type": python_type_str,
            "title": field_info.title or name.replace("_", " ").title(),
            "description": field_info.description,
            "required": not is_optional_type(field_info.annotation),
            "default": field_info.default if field_info.default is not PydanticUndefined else None,
            "literal_values": literal_values,
            "ui_config": ui_config,
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

        # Extract field config
        field_config = extract_field_config(field_info, field_type, class_configs)
        ui_config = build_ui_config(field_config) if field_config else None

        return {
            "type": get_json_type(field_type),
            "python_type": field_type.__name__,
            "title": field_info.title or name.replace("_", " ").title(),
            "description": field_info.description,
            "required": not is_optional_type(field_info.annotation),
            "default": default_value,
            "enum": enum_values,
            "ui_config": ui_config,
        }

    # Handle List/Set/Tuple
    if origin in (list, set, tuple):
        item_type = args[0] if args else str

        # Extract field config
        field_config = extract_field_config(field_info, field_type, class_configs)
        ui_config = build_ui_config(field_config) if field_config else None

        return {
            "type": "array",
            "python_type": get_python_type_name(field_type),
            "title": field_info.title or name.replace("_", " ").title(),
            "description": field_info.description,
            "required": True,
            "items": parse_field(
                "item", FieldInfo(), item_type, max_depth, current_depth + 1, class_configs
            ),
            "ui_config": ui_config,
        }

    # Handle Dict
    if origin is dict:
        value_type = args[1] if len(args) > 1 else Any  # type: ignore

        # Extract field config
        field_config = extract_field_config(field_info, field_type, class_configs)
        ui_config = build_ui_config(field_config) if field_config else None

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
                current_depth + 1,
                class_configs,
            ),
            "ui_config": ui_config,
        }

    # Handle nested Pydantic models
    if isinstance(field_type, type) and issubclass(field_type, BaseModel):
        result = parse_model(field_type, max_depth, current_depth + 1, class_configs)
        # Add title from field_info if available, otherwise use field name (not model name)
        result["title"] = field_info.title or name.replace("_", " ").title()
        # Nested models are required by default unless wrapped in Optional
        result["required"] = not is_optional_type(field_info.annotation)
        result["python_type"] = field_type.__name__
        # Add description from field_info
        if field_info.description:
            result["description"] = field_info.description
        # Extract and add ui_config for nested models
        field_config = extract_field_config(field_info, field_type, class_configs)
        if field_config:
            result["ui_config"] = build_ui_config(field_config)
        return result

    # Handle datetime types
    format_hint = get_format_for_type(field_type)

    # Extract field config
    field_config = extract_field_config(field_info, field_type, class_configs)
    ui_config = build_ui_config(field_config) if field_config else None

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
        "required": not is_optional_type(field_info.annotation),
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
    class_configs: dict[str, FieldConfig] | None = None,
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
            class_configs,
        )

    return {
        "name": model.__name__,
        "type": "object",
        "description": model.__doc__,
        "fields": fields,
    }


def _serialize_value(val: Any) -> Any:
    """Serialize a value to a JSON-safe format."""
    if isinstance(val, BaseModel):
        return val.model_dump(mode="json", warnings=False)
    elif isinstance(val, (datetime.datetime, datetime.date, datetime.time)):
        return val.isoformat()
    elif isinstance(val, list):
        return [_serialize_value(item) for item in val]
    elif isinstance(val, dict):
        return {k: _serialize_value(v) for k, v in val.items()}
    elif isinstance(val, Enum):
        return val.value
    return val


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
                default_val = field_info.default
                data[field_name] = _serialize_value(default_val)
            elif field_info.default_factory is not None:
                try:
                    factory_val = field_info.default_factory()  # type: ignore
                    data[field_name] = _serialize_value(factory_val)
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

    # Handle Optional and Union types
    if origin is Union or origin is types.UnionType:
        args = get_args(field_type)
        non_none = [a for a in args if a is not type(None)]
        # For Optional (single non-None type), use that type's default
        if len(non_none) == 1:
            return _get_type_default(non_none[0])
        # For true unions with multiple types, return None (user must select variant)
        if len(non_none) > 1:
            return None
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

    # Handle Pydantic models - return empty dict
    if is_pydantic_model(field_type):
        return {}

    return None

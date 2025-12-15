"""API route handlers for Pydantic UI."""

from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, ValidationError

from pydantic_ui.config import FieldConfig, UIConfig
from pydantic_ui.models import (
    ActionButtonResponse,
    ConfigResponse,
    ValidationResponse,
)
from pydantic_ui.models import (
    ValidationError as ValidationErrorModel,
)
from pydantic_ui.schema import model_to_data, parse_model
from pydantic_ui.utils import set_value_at_path


class DataHandler:
    """Handles data operations for a Pydantic model."""

    def __init__(
        self,
        model: type[BaseModel],
        ui_config: UIConfig,
        field_configs: dict[str, Any] | None = None,
        initial_data: BaseModel | None = None,
        data_loader: Callable[[], Any] | None = None,
        data_saver: Callable[[BaseModel], None] | None = None,
    ):
        self.model = model
        self.ui_config = ui_config
        self.field_configs = field_configs or {}
        self.data_loader = data_loader
        self.data_saver = data_saver

        # Initialize data
        if initial_data is not None:
            self._data = initial_data.model_dump(mode="json", warnings=False)
        else:
            self._data = model_to_data(model)

    async def get_schema(self) -> dict[str, Any]:
        """Get the parsed schema for the model."""
        schema = parse_model(self.model, class_configs=self.ui_config.class_configs)

        # Apply field configs
        self._apply_field_configs(schema.get("fields", {}))

        return schema

    def _match_field_config(self, path: str) -> FieldConfig | None:
        """Match a field path against field_configs, supporting [] wildcards."""
        # Direct match
        if path in self.field_configs:
            return self.field_configs[path]  # type: ignore

        # Try wildcard patterns - replace array indices with []
        # e.g., "users.0.age" should match "users.[].age"
        import re

        for pattern, config in self.field_configs.items():
            if "[]" in pattern:
                # Convert pattern to regex: "users.[].age" -> "users\.\d+\.age"
                regex_pattern = re.escape(pattern).replace(r"\[\]", r"\d+")
                regex_pattern = f"^{regex_pattern}$"
                if re.match(regex_pattern, path):
                    return config  # type: ignore

        return None

    def _apply_field_configs(self, fields: dict[str, Any], prefix: str = "") -> None:
        """Apply field configurations to schema fields."""
        for field_name, field_schema in fields.items():
            full_path = f"{prefix}{field_name}" if prefix else field_name

            # Check if we have a config for this field (with wildcard support)
            config = self._match_field_config(full_path)
            if config:
                if field_schema.get("ui_config") is None:
                    field_schema["ui_config"] = {}

                # Merge config
                ui_config = field_schema["ui_config"]
                if hasattr(config, "renderer") and config.renderer:
                    ui_config["renderer"] = (
                        config.renderer.value
                        if hasattr(config.renderer, "value")
                        else config.renderer
                    )
                if hasattr(config, "label") and config.label:
                    ui_config["label"] = config.label
                if hasattr(config, "placeholder") and config.placeholder:
                    ui_config["placeholder"] = config.placeholder
                if hasattr(config, "help_text") and config.help_text:
                    ui_config["help_text"] = config.help_text
                if hasattr(config, "hidden"):
                    ui_config["hidden"] = config.hidden
                if hasattr(config, "read_only"):
                    ui_config["read_only"] = config.read_only
                if hasattr(config, "visible_when") and config.visible_when:
                    ui_config["visible_when"] = config.visible_when
                if hasattr(config, "options_from") and config.options_from:
                    ui_config["options_from"] = config.options_from
                if hasattr(config, "props") and config.props:
                    ui_config["props"] = config.props

            # Recurse into nested fields
            if field_schema.get("fields"):
                self._apply_field_configs(field_schema["fields"], f"{full_path}.")

            # Recurse into array items
            if field_schema.get("items"):
                self._apply_field_configs_to_items(field_schema["items"], f"{full_path}.[].")

            # Recurse into union variants
            if field_schema.get("variants"):
                for variant in field_schema["variants"]:
                    if variant.get("fields"):
                        self._apply_field_configs(variant["fields"], f"{full_path}.")
                    if variant.get("items"):
                        self._apply_field_configs_to_items(variant["items"], f"{full_path}.[].")

    def _apply_field_configs_to_items(self, item_schema: dict[str, Any], prefix: str) -> None:
        """Apply field configurations to array item schema."""
        # If items is an object with fields, recurse into those fields
        if item_schema.get("fields"):
            self._apply_field_configs(item_schema["fields"], prefix)

    async def get_data(self) -> dict[str, Any]:
        """Get the current data."""
        if self.data_loader is not None:
            try:
                loaded = self.data_loader()
                # Handle async loaders
                if hasattr(loaded, "__await__"):
                    loaded = await loaded
                if isinstance(loaded, BaseModel):
                    self._data = loaded.model_dump(mode="json", warnings=False)
                elif isinstance(loaded, dict):
                    self._data = loaded
            except Exception:
                pass

        return {"data": self._data}

    async def update_data(self, data: dict[str, Any]) -> dict[str, Any]:
        """Update the entire data."""
        # Validate with the model
        try:
            instance = self.model.model_validate(data)
            self._data = instance.model_dump(mode="json", warnings=False)

            # Call saver if provided
            if self.data_saver is not None:
                result = self.data_saver(instance)
                if hasattr(result, "__await__"):
                    await result  # type: ignore

            return {"data": self._data, "valid": True}
        except ValidationError as e:
            return {
                "data": data,
                "valid": False,
                "errors": [
                    {
                        "path": ".".join(str(loc) for loc in err["loc"]),
                        "message": err["msg"],
                        "type": err["type"],
                    }
                    for err in e.errors()
                ],
            }

    async def partial_update(self, path: str, value: Any) -> dict[str, Any]:
        """Update a specific path in the data."""
        new_data = set_value_at_path(self._data.copy(), path, value)

        # Validate the entire model
        try:
            instance = self.model.model_validate(new_data)
            self._data = instance.model_dump(mode="json", warnings=False)

            if self.data_saver is not None:
                result = self.data_saver(instance)
                if hasattr(result, "__await__"):
                    await result  # type: ignore

            return {"data": self._data, "valid": True}
        except ValidationError as e:
            # Still update the data but return errors
            self._data = new_data
            return {
                "data": self._data,
                "valid": False,
                "errors": [
                    {
                        "path": ".".join(str(loc) for loc in err["loc"]),
                        "message": err["msg"],
                        "type": err["type"],
                    }
                    for err in e.errors()
                ],
            }

    async def validate_data(self, data: dict[str, Any]) -> ValidationResponse:
        """Validate data without saving."""
        try:
            self.model.model_validate(data)
            return ValidationResponse(valid=True, errors=[])
        except ValidationError as e:
            errors = [
                ValidationErrorModel(
                    path=".".join(str(loc) for loc in err["loc"]),
                    message=err["msg"],
                    type=err["type"],
                )
                for err in e.errors()
            ]
            return ValidationResponse(valid=False, errors=errors)

    def get_config(self) -> ConfigResponse:
        """Get the UI configuration."""
        # Convert actions to response format
        actions = [
            ActionButtonResponse(
                id=action.id,
                label=action.label,
                variant=action.variant,
                icon=action.icon,
                disabled=action.disabled,
                tooltip=action.tooltip,
                confirm=action.confirm,
                upload_file=action.upload_file,
            )
            for action in self.ui_config.actions
        ]

        return ConfigResponse(
            title=self.ui_config.title,
            description=self.ui_config.description,
            theme=self.ui_config.theme,
            read_only=self.ui_config.read_only,
            show_validation=self.ui_config.show_validation,
            auto_save=self.ui_config.auto_save,
            auto_save_delay=self.ui_config.auto_save_delay,
            collapsible_tree=self.ui_config.collapsible_tree,
            show_types=self.ui_config.show_types,
            actions=actions,
            show_save_reset=self.ui_config.show_save_reset,
        )

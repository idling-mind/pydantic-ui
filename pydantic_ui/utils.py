"""Utility functions for Pydantic UI."""

from typing import Any


def get_value_at_path(data: dict[str, Any], path: str) -> Any:
    """Get a value from nested data using dot notation path.

    Args:
        data: The nested data dictionary
        path: Dot-separated path (e.g., "address.city" or "employees[0].name")

    Returns:
        The value at the path, or None if not found
    """
    if not path or path == "root":
        return data

    parts = path.replace("root.", "").split(".")
    current = data

    for part in parts:
        if not part:
            continue

        # Handle array index notation [n]
        if part.startswith("[") and part.endswith("]"):
            try:
                index = int(part[1:-1])
                if isinstance(current, list) and 0 <= index < len(current):
                    current = current[index]
                else:
                    return None
            except (ValueError, IndexError):
                return None
        elif isinstance(current, dict):
            current = current.get(part)  # type: ignore
            if current is None:
                return None
        elif isinstance(current, list):
            # Try to parse as index
            try:
                index = int(part)
                current = current[index]
            except (ValueError, IndexError):
                return None
        else:
            return None

    return current


def set_value_at_path(data: dict[str, Any], path: str, value: Any) -> dict[str, Any]:
    """Set a value in nested data using dot notation path.

    Args:
        data: The nested data dictionary (will be modified in place)
        path: Dot-separated path (e.g., "address.city" or "employees[0].name")
        value: The value to set

    Returns:
        The modified data dictionary
    """
    if not path or path == "root":
        if isinstance(value, dict):
            return value
        return data

    parts = path.replace("root.", "").split(".")
    current = data

    for i, part in enumerate(parts[:-1]):
        if not part:
            continue

        # Handle array index notation [n]
        if part.startswith("[") and part.endswith("]"):
            try:
                index = int(part[1:-1])
                if isinstance(current, list):
                    while len(current) <= index:
                        current.append({})
                    current = current[index]
            except ValueError:
                pass
        elif isinstance(current, dict):
            if part not in current:
                # Check if next part is an array index
                next_part = parts[i + 1] if i + 1 < len(parts) else ""
                if next_part.startswith("["):
                    current[part] = []
                else:
                    current[part] = {}
            current = current[part]
        elif isinstance(current, list):
            try:
                index = int(part)
                while len(current) <= index:
                    current.append({})
                current = current[index]
            except ValueError:
                pass

    # Set the final value
    final_part = parts[-1]
    if final_part.startswith("[") and final_part.endswith("]"):
        try:
            index = int(final_part[1:-1])
            if isinstance(current, list):
                while len(current) <= index:
                    current.append(None)
                current[index] = value
        except ValueError:
            pass
    elif isinstance(current, dict):
        current[final_part] = value
    elif isinstance(current, list):
        try:
            index = int(final_part)
            while len(current) <= index:
                current.append(None)
            current[index] = value
        except ValueError:
            pass

    return data


def delete_at_path(data: dict[str, Any], path: str) -> dict[str, Any]:
    """Delete a value from nested data using dot notation path.

    Args:
        data: The nested data dictionary (will be modified in place)
        path: Dot-separated path

    Returns:
        The modified data dictionary
    """
    if not path or path == "root":
        return {}

    parts = path.replace("root.", "").split(".")
    current = data

    for part in parts[:-1]:
        if not part:
            continue

        if part.startswith("[") and part.endswith("]"):
            try:
                index = int(part[1:-1])
                if isinstance(current, list) and 0 <= index < len(current):
                    current = current[index]
                else:
                    return data
            except ValueError:
                return data
        elif isinstance(current, dict):
            if part not in current:
                return data
            current = current[part]
        elif isinstance(current, list):
            # Handle numeric index without brackets
            try:
                index = int(part)
                if 0 <= index < len(current):
                    current = current[index]
                else:
                    return data
            except ValueError:
                return data
        else:
            return data

    # Delete the final part
    final_part = parts[-1]
    if final_part.startswith("[") and final_part.endswith("]"):
        try:
            index = int(final_part[1:-1])
            if isinstance(current, list) and 0 <= index < len(current):
                current.pop(index)
        except ValueError:
            pass
    elif isinstance(current, dict) and final_part in current:
        del current[final_part]
    elif isinstance(current, list):
        try:
            index = int(final_part)
            if 0 <= index < len(current):
                current.pop(index)
        except ValueError:
            pass

    return data

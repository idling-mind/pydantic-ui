"""Tests for pydantic_ui/utils.py - Utility functions."""

from __future__ import annotations

import pytest

from pydantic_ui.utils import delete_at_path, get_value_at_path, set_value_at_path


# =============================================================================
# Tests for get_value_at_path()
# =============================================================================


class TestGetValueAtPath:
    """Tests for get_value_at_path function."""

    def test_simple_path(self):
        """Test getting value at simple path."""
        data = {"name": "John", "age": 30}
        assert get_value_at_path(data, "name") == "John"
        assert get_value_at_path(data, "age") == 30

    def test_nested_path(self):
        """Test getting value at nested path."""
        data = {"address": {"city": "NYC", "zip": "10001"}}
        assert get_value_at_path(data, "address.city") == "NYC"
        assert get_value_at_path(data, "address.zip") == "10001"

    def test_array_index(self):
        """Test getting value with numeric array index."""
        data = {"items": ["a", "b", "c"]}
        assert get_value_at_path(data, "items.0") == "a"
        assert get_value_at_path(data, "items.2") == "c"

    def test_array_bracket_notation(self):
        """Test getting value with bracket notation."""
        data = {"items": ["a", "b", "c"]}
        assert get_value_at_path(data, "items.[0]") == "a"
        assert get_value_at_path(data, "items.[2]") == "c"

    def test_mixed_path(self):
        """Test getting value with mixed path (objects and arrays)."""
        data = {
            "users": [
                {"name": "Alice", "age": 25},
                {"name": "Bob", "age": 30},
            ]
        }
        assert get_value_at_path(data, "users.0.name") == "Alice"
        assert get_value_at_path(data, "users.1.age") == 30

    def test_root_path(self):
        """Test getting value at root path."""
        data = {"name": "test"}
        assert get_value_at_path(data, "root") == data
        assert get_value_at_path(data, "") == data

    def test_empty_path(self):
        """Test empty path returns entire data."""
        data = {"name": "test"}
        assert get_value_at_path(data, "") == data

    def test_not_found_returns_none(self):
        """Test non-existent path returns None."""
        data = {"name": "test"}
        assert get_value_at_path(data, "missing") is None
        assert get_value_at_path(data, "deeply.nested.missing") is None

    def test_invalid_index_returns_none(self):
        """Test invalid array index returns None."""
        data = {"items": ["a", "b"]}
        assert get_value_at_path(data, "items.10") is None
        assert get_value_at_path(data, "items.[10]") is None

    def test_deeply_nested(self):
        """Test deeply nested paths."""
        data = {"a": {"b": {"c": {"d": {"e": "deep"}}}}}
        assert get_value_at_path(data, "a.b.c.d.e") == "deep"

    def test_with_root_prefix(self):
        """Test path with root prefix."""
        data = {"name": "test"}
        assert get_value_at_path(data, "root.name") == "test"


# =============================================================================
# Tests for set_value_at_path()
# =============================================================================


class TestSetValueAtPath:
    """Tests for set_value_at_path function."""

    def test_simple_path(self):
        """Test setting value at simple path."""
        data = {"name": "John", "age": 30}
        result = set_value_at_path(data, "name", "Jane")
        assert result["name"] == "Jane"
        assert result["age"] == 30

    def test_nested_path(self):
        """Test setting value at nested path."""
        data = {"address": {"city": "NYC", "zip": "10001"}}
        result = set_value_at_path(data, "address.city", "LA")
        assert result["address"]["city"] == "LA"
        assert result["address"]["zip"] == "10001"

    def test_array_index(self):
        """Test setting value at array index."""
        data = {"items": ["a", "b", "c"]}
        result = set_value_at_path(data, "items.1", "x")
        assert result["items"] == ["a", "x", "c"]

    def test_create_nested(self):
        """Test creating nested structure."""
        data = {}
        result = set_value_at_path(data, "address.city", "NYC")
        assert result["address"]["city"] == "NYC"

    def test_create_array(self):
        """Test creating array structure."""
        data = {"items": []}
        result = set_value_at_path(data, "items.0", "first")
        assert result["items"][0] == "first"

    def test_root_path(self):
        """Test setting value at root replaces data."""
        data = {"old": "data"}
        result = set_value_at_path(data, "root", {"new": "data"})
        assert result == {"new": "data"}

    def test_extend_array(self):
        """Test extending array with new indices."""
        data = {"items": ["a"]}
        result = set_value_at_path(data, "items.2", "c")
        assert len(result["items"]) == 3
        assert result["items"][2] == "c"

    def test_mixed_path_creation(self):
        """Test creating mixed structure (objects and arrays)."""
        data = {}
        result = set_value_at_path(data, "users.[0].name", "Alice")
        assert result["users"][0]["name"] == "Alice"

    def test_bracket_notation(self):
        """Test setting value with bracket notation."""
        data = {"items": ["a", "b", "c"]}
        result = set_value_at_path(data, "items.[1]", "x")
        assert result["items"][1] == "x"

    def test_deeply_nested_creation(self):
        """Test creating deeply nested structure."""
        data = {}
        result = set_value_at_path(data, "a.b.c.d", "value")
        assert result["a"]["b"]["c"]["d"] == "value"


# =============================================================================
# Tests for delete_at_path()
# =============================================================================


class TestDeleteAtPath:
    """Tests for delete_at_path function."""

    def test_simple_delete(self):
        """Test deleting simple key."""
        data = {"name": "John", "age": 30}
        result = delete_at_path(data, "name")
        assert "name" not in result
        assert result["age"] == 30

    def test_nested_delete(self):
        """Test deleting nested key."""
        data = {"address": {"city": "NYC", "zip": "10001"}}
        result = delete_at_path(data, "address.city")
        assert "city" not in result["address"]
        assert result["address"]["zip"] == "10001"

    def test_array_item_delete(self):
        """Test deleting array item."""
        data = {"items": ["a", "b", "c"]}
        result = delete_at_path(data, "items.1")
        assert result["items"] == ["a", "c"]

    def test_root_delete_returns_empty(self):
        """Test deleting root returns empty dict."""
        data = {"name": "test", "value": 42}
        result = delete_at_path(data, "root")
        assert result == {}

    def test_delete_not_found(self):
        """Test deleting non-existent path returns unchanged data."""
        data = {"name": "test"}
        result = delete_at_path(data, "missing")
        assert result == {"name": "test"}

    def test_delete_deeply_nested(self):
        """Test deleting from deeply nested structure."""
        data = {"a": {"b": {"c": "value", "d": "keep"}}}
        result = delete_at_path(data, "a.b.c")
        assert "c" not in result["a"]["b"]
        assert result["a"]["b"]["d"] == "keep"

    def test_delete_with_bracket_notation(self):
        """Test deleting array item with bracket notation."""
        data = {"items": ["a", "b", "c"]}
        result = delete_at_path(data, "items.[1]")
        assert result["items"] == ["a", "c"]

    def test_delete_nested_in_array(self):
        """Test deleting key in object within array."""
        data = {"users": [{"name": "Alice", "age": 25}]}
        result = delete_at_path(data, "users.0.age")
        assert "age" not in result["users"][0]
        assert result["users"][0]["name"] == "Alice"

    def test_empty_path_returns_empty(self):
        """Test empty path returns empty dict."""
        data = {"name": "test"}
        result = delete_at_path(data, "")
        assert result == {}

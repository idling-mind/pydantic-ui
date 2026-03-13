"""E2E tests for multi-select functionality in tree panel.

Tests tree panel multi-selection interactions including:
- Ctrl+click to toggle individual items
- Shift+click to select a range of items
- Ctrl+Shift+click to add a range to existing selection
- Combining shift and ctrl selection modes

Run these tests with:
    uv run pytest tests/e2e/test_multi_select.py -v

Requires the e2e_test_app.py example to be running at http://localhost:8000
"""

import pytest
from playwright.sync_api import Page, expect

from .helpers import (
    SELECTORS,
    expand_all_tree_nodes,
    wait_for_app_load,
    wait_for_tree_loaded,
)

pytestmark = pytest.mark.e2e


def get_visible_tree_nodes(page: Page):
    """Return all visible tree nodes."""
    return page.locator(SELECTORS["tree_node"])


def get_multi_selected_nodes(page: Page):
    """Return nodes that have the multi-select ring style (ring-2 class)."""
    # Multi-selected nodes get ring-2 ring-primary ring-inset classes
    return page.locator('[data-tree-path].ring-2')


def get_selected_node(page: Page):
    """Return the single-selected node (bg-accent)."""
    return page.locator(
        '[data-pydantic-ui="tree-node"][data-pydantic-ui-selected="true"]'
    )


class TestCtrlClickMultiSelect:
    """Tests for Ctrl+Click multi-selection."""

    def test_ctrl_click_selects_multiple_nodes(self, page: Page, base_url: str):
        """Test that Ctrl+Click adds nodes to multi-selection."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        nodes = get_visible_tree_nodes(page)
        count = nodes.count()
        assert count >= 3, "Need at least 3 visible nodes for this test"

        # Ctrl+click two different nodes
        nodes.nth(1).click(modifiers=["Control"])
        page.wait_for_timeout(200)
        nodes.nth(3).click(modifiers=["Control"])
        page.wait_for_timeout(200)

        multi = get_multi_selected_nodes(page)
        assert multi.count() == 2, f"Expected 2 multi-selected nodes, got {multi.count()}"

    def test_ctrl_click_toggles_node_off(self, page: Page, base_url: str):
        """Test that Ctrl+Click on an already selected node deselects it."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        nodes = get_visible_tree_nodes(page)

        # Ctrl+click to select
        nodes.nth(1).click(modifiers=["Control"])
        page.wait_for_timeout(200)
        nodes.nth(2).click(modifiers=["Control"])
        page.wait_for_timeout(200)

        assert get_multi_selected_nodes(page).count() == 2

        # Ctrl+click to deselect the first one
        nodes.nth(1).click(modifiers=["Control"])
        page.wait_for_timeout(200)

        assert get_multi_selected_nodes(page).count() == 1

    def test_plain_click_clears_multi_selection(self, page: Page, base_url: str):
        """Test that a normal click clears multi-selection."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        nodes = get_visible_tree_nodes(page)

        # Ctrl+click to multi-select
        nodes.nth(1).click(modifiers=["Control"])
        page.wait_for_timeout(200)
        nodes.nth(2).click(modifiers=["Control"])
        page.wait_for_timeout(200)

        assert get_multi_selected_nodes(page).count() == 2

        # Normal click should clear multi-selection
        nodes.nth(3).click()
        page.wait_for_timeout(200)

        assert get_multi_selected_nodes(page).count() == 0
        # The clicked node should be the single-selected one
        selected = get_selected_node(page)
        assert selected.count() == 1


class TestShiftClickRangeSelect:
    """Tests for Shift+Click range selection."""

    def test_shift_click_selects_range(self, page: Page, base_url: str):
        """Test that clicking a node then Shift+clicking another selects the range."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        nodes = get_visible_tree_nodes(page)
        count = nodes.count()
        assert count >= 5, "Need at least 5 visible nodes for this test"

        # Click first node (sets anchor)
        nodes.nth(1).click()
        page.wait_for_timeout(200)

        # Shift+click fourth node (selects range 1..4)
        nodes.nth(4).click(modifiers=["Shift"])
        page.wait_for_timeout(200)

        multi = get_multi_selected_nodes(page)
        assert multi.count() == 4, f"Expected 4 multi-selected nodes, got {multi.count()}"

    def test_shift_click_selects_range_upward(self, page: Page, base_url: str):
        """Test that Shift+Click works when clicking above the anchor."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        nodes = get_visible_tree_nodes(page)
        count = nodes.count()
        assert count >= 5, "Need at least 5 visible nodes for this test"

        # Click a lower node first (sets anchor)
        nodes.nth(4).click()
        page.wait_for_timeout(200)

        # Shift+click an upper node
        nodes.nth(1).click(modifiers=["Shift"])
        page.wait_for_timeout(200)

        multi = get_multi_selected_nodes(page)
        assert multi.count() == 4, f"Expected 4 multi-selected nodes, got {multi.count()}"

    def test_shift_click_replaces_previous_range(self, page: Page, base_url: str):
        """Test that a second Shift+Click replaces the previous range."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        nodes = get_visible_tree_nodes(page)
        count = nodes.count()
        assert count >= 6, "Need at least 6 visible nodes for this test"

        # Click anchor
        nodes.nth(1).click()
        page.wait_for_timeout(200)

        # Shift+click to select range 1..4
        nodes.nth(4).click(modifiers=["Shift"])
        page.wait_for_timeout(200)
        assert get_multi_selected_nodes(page).count() == 4

        # Shift+click a different endpoint (1..2) — replaces the range
        nodes.nth(2).click(modifiers=["Shift"])
        page.wait_for_timeout(200)

        multi = get_multi_selected_nodes(page)
        assert multi.count() == 2, f"Expected 2 multi-selected nodes, got {multi.count()}"

    def test_plain_click_after_shift_clears_range(self, page: Page, base_url: str):
        """Test that a plain click after Shift+Click clears the range selection."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        nodes = get_visible_tree_nodes(page)

        # Select a range
        nodes.nth(1).click()
        page.wait_for_timeout(200)
        nodes.nth(3).click(modifiers=["Shift"])
        page.wait_for_timeout(200)

        assert get_multi_selected_nodes(page).count() == 3

        # Plain click clears the range
        nodes.nth(5).click()
        page.wait_for_timeout(200)

        assert get_multi_selected_nodes(page).count() == 0
        selected = get_selected_node(page)
        assert selected.count() == 1


class TestCombinedSelection:
    """Tests for combining Ctrl+Click and Shift+Click."""

    def test_ctrl_shift_click_adds_range_to_existing(self, page: Page, base_url: str):
        """Test that Ctrl+Shift+Click adds a range to the existing selection."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        nodes = get_visible_tree_nodes(page)
        count = nodes.count()
        assert count >= 8, "Need at least 8 visible nodes for this test"

        # Ctrl+click to select individual nodes
        nodes.nth(1).click(modifiers=["Control"])
        page.wait_for_timeout(200)
        nodes.nth(2).click(modifiers=["Control"])
        page.wait_for_timeout(200)

        assert get_multi_selected_nodes(page).count() == 2

        # Ctrl+Shift+click to add a range (anchor from last ctrl+click at 2, range 2..5)
        nodes.nth(5).click(modifiers=["Control", "Shift"])
        page.wait_for_timeout(200)

        multi = get_multi_selected_nodes(page)
        # Should have original 2 nodes + nodes from range (some overlap possible)
        assert multi.count() >= 4, f"Expected at least 4 nodes, got {multi.count()}"

    def test_ctrl_click_after_shift_range(self, page: Page, base_url: str):
        """Test that Ctrl+Click after a Shift range adds individual nodes."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        nodes = get_visible_tree_nodes(page)
        count = nodes.count()
        assert count >= 8, "Need at least 8 visible nodes for this test"

        # Select a range with click + shift+click
        nodes.nth(1).click()
        page.wait_for_timeout(200)
        nodes.nth(3).click(modifiers=["Shift"])
        page.wait_for_timeout(200)

        range_count = get_multi_selected_nodes(page).count()
        assert range_count == 3

        # Now Ctrl+click to add an individual node outside the range
        nodes.nth(6).click(modifiers=["Control"])
        page.wait_for_timeout(200)

        multi = get_multi_selected_nodes(page)
        assert multi.count() == range_count + 1, (
            f"Expected {range_count + 1} nodes, got {multi.count()}"
        )

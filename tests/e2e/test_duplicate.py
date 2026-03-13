"""E2E tests for duplicate functionality in tree panel.

Tests tree panel duplicate interactions including:
- Right-click context menu Duplicate option on array items
- Duplicate dialog with count selection
- Ctrl+D keyboard shortcut for duplicate
- Multi-select duplicate (duplicate multiple items at once)

Run these tests with:
    uv run pytest tests/e2e/test_duplicate.py -v

Requires the e2e_test_app.py example to be running at http://localhost:8000
"""

import pytest
from playwright.sync_api import Page, expect

from .helpers import (
    click_tree_node_by_path,
    expand_all_tree_nodes,
    get_tree_node_by_path,
    wait_for_app_load,
)

pytestmark = pytest.mark.e2e


def get_users_item_nodes(page: Page):
    """Return tree nodes for users array items (users[0], users[1], ...)."""
    return page.locator('[data-tree-path^="users["]').filter(
        has=page.locator('[data-pydantic-ui="tree-node"]')
    )


def count_users_items(page: Page) -> int:
    """Count visible user item nodes in the tree (top-level array items only)."""
    # Match users[N] but not users[N].something
    nodes = page.locator("[data-tree-path]")
    count = 0
    for i in range(nodes.count()):
        path = nodes.nth(i).get_attribute("data-tree-path") or ""
        if path.startswith("users[") and "." not in path:
            count += 1
    return count


class TestDuplicateContextMenu:
    """Tests for Duplicate via right-click context menu."""

    def test_duplicate_option_appears_for_array_items(self, page: Page, base_url: str):
        """Test that Duplicate appears in context menu for array items."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        # Right-click on users[0]
        node = page.locator(get_tree_node_by_path("users[0]"))
        node.click(button="right")
        page.wait_for_timeout(300)

        # Duplicate menu item should be visible
        duplicate_item = page.locator('[data-pydantic-ui="context-menu-duplicate"]')
        expect(duplicate_item).to_be_visible()

    def test_duplicate_option_not_shown_for_non_array_items(self, page: Page, base_url: str):
        """Test that Duplicate does not appear for non-array nodes."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        # Right-click on a non-array node (e.g. owner)
        node = page.locator(get_tree_node_by_path("owner"))
        node.click(button="right")
        page.wait_for_timeout(300)

        # Duplicate menu item should NOT be visible
        duplicate_item = page.locator('[data-pydantic-ui="context-menu-duplicate"]')
        expect(duplicate_item).not_to_be_visible()

    def test_duplicate_one_item_via_context_menu(self, page: Page, base_url: str):
        """Test duplicating a single array item via context menu."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        initial_count = count_users_items(page)
        assert initial_count == 2, f"Expected 2 users initially, got {initial_count}"

        # Right-click on users[0]
        node = page.locator(get_tree_node_by_path("users[0]"))
        node.click(button="right")
        page.wait_for_timeout(300)

        # Click Duplicate
        page.locator('[data-pydantic-ui="context-menu-duplicate"]').click()
        page.wait_for_timeout(300)

        # Dialog should appear
        dialog = page.locator('[data-pydantic-ui="duplicate-dialog"]')
        expect(dialog).to_be_visible()

        # Default count should be 1
        count_input = page.locator('[data-pydantic-ui="duplicate-count-input"]')
        expect(count_input).to_have_value("1")

        # Confirm duplicate
        page.locator('[data-pydantic-ui="duplicate-confirm"]').click()
        page.wait_for_timeout(500)

        # Should have one more user now
        new_count = count_users_items(page)
        assert new_count == initial_count + 1, (
            f"Expected {initial_count + 1} users after duplicate, got {new_count}"
        )

    def test_duplicate_multiple_copies_via_context_menu(self, page: Page, base_url: str):
        """Test duplicating with count > 1 via context menu."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        initial_count = count_users_items(page)

        # Right-click on users[0]
        node = page.locator(get_tree_node_by_path("users[0]"))
        node.click(button="right")
        page.wait_for_timeout(300)

        page.locator('[data-pydantic-ui="context-menu-duplicate"]').click()
        page.wait_for_timeout(300)

        # Set count to 3
        count_input = page.locator('[data-pydantic-ui="duplicate-count-input"]')
        count_input.fill("3")
        page.wait_for_timeout(100)

        page.locator('[data-pydantic-ui="duplicate-confirm"]').click()
        page.wait_for_timeout(500)

        new_count = count_users_items(page)
        assert new_count == initial_count + 3, (
            f"Expected {initial_count + 3} users after duplicating 3 copies, got {new_count}"
        )


class TestDuplicateKeyboardShortcut:
    """Tests for Ctrl+D keyboard shortcut."""

    def test_ctrl_d_opens_duplicate_dialog_on_array_item(self, page: Page, base_url: str):
        """Test that Ctrl+D opens the duplicate dialog when an array item is selected."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        # Select users[0]
        click_tree_node_by_path(page, "users[0]")
        page.wait_for_timeout(200)

        # Press Ctrl+D
        page.keyboard.press("Control+d")
        page.wait_for_timeout(300)

        # Dialog should appear
        dialog = page.locator('[data-pydantic-ui="duplicate-dialog"]')
        expect(dialog).to_be_visible()

    def test_ctrl_d_does_nothing_on_non_array_item(self, page: Page, base_url: str):
        """Test that Ctrl+D does nothing when a non-array node is selected."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        # Select a non-array node
        click_tree_node_by_path(page, "owner")
        page.wait_for_timeout(200)

        # Press Ctrl+D
        page.keyboard.press("Control+d")
        page.wait_for_timeout(300)

        # Dialog should NOT appear
        dialog = page.locator('[data-pydantic-ui="duplicate-dialog"]')
        expect(dialog).not_to_be_visible()

    def test_ctrl_d_duplicates_item(self, page: Page, base_url: str):
        """Test that Ctrl+D followed by confirm duplicates the item."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        initial_count = count_users_items(page)

        # Select users[1]
        click_tree_node_by_path(page, "users[1]")
        page.wait_for_timeout(200)

        # Press Ctrl+D
        page.keyboard.press("Control+d")
        page.wait_for_timeout(300)

        # Confirm with default count of 1
        page.locator('[data-pydantic-ui="duplicate-confirm"]').click()
        page.wait_for_timeout(500)

        new_count = count_users_items(page)
        assert new_count == initial_count + 1, (
            f"Expected {initial_count + 1} users after Ctrl+D duplicate, got {new_count}"
        )


class TestDuplicateMultiSelect:
    """Tests for duplicating multiple selected items."""

    def test_ctrl_d_with_multi_selected_items(self, page: Page, base_url: str):
        """Test Ctrl+D duplicates all multi-selected array items."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        initial_count = count_users_items(page)
        assert initial_count == 2, f"Expected 2 users initially, got {initial_count}"

        # Ctrl+click to multi-select users[0] and users[1]
        node0 = page.locator(get_tree_node_by_path("users[0]"))
        node1 = page.locator(get_tree_node_by_path("users[1]"))

        node0.click(modifiers=["Control"])
        page.wait_for_timeout(200)
        node1.click(modifiers=["Control"])
        page.wait_for_timeout(200)

        # Press Ctrl+D
        page.keyboard.press("Control+d")
        page.wait_for_timeout(300)

        # Dialog should appear and show "2 Items"
        dialog = page.locator('[data-pydantic-ui="duplicate-dialog"]')
        expect(dialog).to_be_visible()
        expect(dialog).to_contain_text("2 Items")

        # Confirm with default count of 1
        page.locator('[data-pydantic-ui="duplicate-confirm"]').click()
        page.wait_for_timeout(500)

        # Both items duplicated -> 2 + 2 = 4
        new_count = count_users_items(page)
        assert new_count == initial_count + 2, (
            f"Expected {initial_count + 2} users after multi-duplicate, got {new_count}"
        )

    def test_selection_cleared_after_duplicate(self, page: Page, base_url: str):
        """Test that multi-selection is cleared after duplicating."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        # Ctrl+click to multi-select users[0] and users[1]
        node0 = page.locator(get_tree_node_by_path("users[0]"))
        node1 = page.locator(get_tree_node_by_path("users[1]"))
        node0.click(modifiers=["Control"])
        page.wait_for_timeout(200)
        node1.click(modifiers=["Control"])
        page.wait_for_timeout(200)

        # Verify multi-selection is active (ring-2 class present)
        tree_panel = page.locator('[data-pydantic-ui="tree-panel"]')
        multi_selected = tree_panel.locator(".ring-2")
        assert multi_selected.count() >= 2, "Expected at least 2 multi-selected nodes"

        # Duplicate via Ctrl+D
        page.keyboard.press("Control+d")
        page.wait_for_timeout(300)
        page.locator('[data-pydantic-ui="duplicate-confirm"]').click()
        page.wait_for_timeout(500)

        # Multi-selection should be cleared
        multi_selected_after = tree_panel.locator(".ring-2")
        assert multi_selected_after.count() == 0, (
            f"Expected 0 multi-selected nodes after duplicate, got {multi_selected_after.count()}"
        )

    def test_context_menu_shows_multi_item_count(self, page: Page, base_url: str):
        """Test that context menu shows item count when multiple items are selected."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        # Ctrl+click to multi-select users[0] and users[1]
        node0 = page.locator(get_tree_node_by_path("users[0]"))
        node1 = page.locator(get_tree_node_by_path("users[1]"))

        node0.click(modifiers=["Control"])
        page.wait_for_timeout(200)
        node1.click(modifiers=["Control"])
        page.wait_for_timeout(200)

        # Right-click on one of the selected nodes
        node0.click(button="right")
        page.wait_for_timeout(300)

        # Duplicate should show item count
        duplicate_item = page.locator('[data-pydantic-ui="context-menu-duplicate"]')
        expect(duplicate_item).to_be_visible()
        expect(duplicate_item).to_contain_text("2 items")

    def test_context_menu_duplicate_clears_selection(self, page: Page, base_url: str):
        """Test that context menu duplicate clears multi-selection."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        # Ctrl+click to multi-select users[0] and users[1]
        node0 = page.locator(get_tree_node_by_path("users[0]"))
        node1 = page.locator(get_tree_node_by_path("users[1]"))
        node0.click(modifiers=["Control"])
        page.wait_for_timeout(200)
        node1.click(modifiers=["Control"])
        page.wait_for_timeout(200)

        # Verify selection exists
        tree_panel = page.locator('[data-pydantic-ui="tree-panel"]')
        assert tree_panel.locator(".ring-2").count() >= 2

        # Right-click and duplicate
        node0.click(button="right")
        page.wait_for_timeout(300)
        page.locator('[data-pydantic-ui="context-menu-duplicate"]').click()
        page.wait_for_timeout(300)
        page.locator('[data-pydantic-ui="duplicate-confirm"]').click()
        page.wait_for_timeout(500)

        # Selection should be cleared
        assert tree_panel.locator(".ring-2").count() == 0, (
            "Expected multi-selection to be cleared after context menu duplicate"
        )


class TestDuplicatePlacement:
    """Tests for the duplicate placement radio option (at-end vs after-each)."""

    def _get_users_paths_in_order(self, page: Page) -> list[str]:
        """Return list of users[N] tree-path attributes in DOM order."""
        nodes = page.locator("[data-tree-path]")
        paths: list[str] = []
        for i in range(nodes.count()):
            p = nodes.nth(i).get_attribute("data-tree-path") or ""
            if p.startswith("users[") and "." not in p:
                paths.append(p)
        return paths

    def test_placement_radio_visible_in_dialog(self, page: Page, base_url: str):
        """Test that the placement radio group is shown in the duplicate dialog."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        click_tree_node_by_path(page, "users[0]")
        page.wait_for_timeout(200)
        page.keyboard.press("Control+d")
        page.wait_for_timeout(300)

        dialog = page.locator('[data-pydantic-ui="duplicate-dialog"]')
        expect(dialog).to_be_visible()

        # Both radio options should be visible
        end_radio = page.locator('[data-pydantic-ui="duplicate-placement-end"]')
        after_radio = page.locator('[data-pydantic-ui="duplicate-placement-after"]')
        expect(end_radio).to_be_visible()
        expect(after_radio).to_be_visible()

        # "At end of list" should be selected by default
        expect(end_radio).to_have_attribute("data-state", "checked")

    def test_duplicate_at_end_single_item(self, page: Page, base_url: str):
        """Test duplicating a single item with 'at end' placement."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        initial_count = count_users_items(page)
        assert initial_count == 2

        # Right-click users[0] (Alice) and duplicate with "at end"
        node = page.locator(get_tree_node_by_path("users[0]"))
        node.click(button="right")
        page.wait_for_timeout(300)
        page.locator('[data-pydantic-ui="context-menu-duplicate"]').click()
        page.wait_for_timeout(300)

        # "At end" is default, just confirm
        page.locator('[data-pydantic-ui="duplicate-confirm"]').click()
        page.wait_for_timeout(500)

        # Should have 3 items: Alice, Bob, Alice-copy at end
        new_count = count_users_items(page)
        assert new_count == 3

        paths = self._get_users_paths_in_order(page)
        assert len(paths) == 3
        # users[2] should be the duplicate at end
        assert paths == ["users[0]", "users[1]", "users[2]"]

    def test_duplicate_after_each_single_item(self, page: Page, base_url: str):
        """Test duplicating a single item with 'after each' placement."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        initial_count = count_users_items(page)
        assert initial_count == 2

        # Right-click users[0] (Alice) and duplicate with "after each"
        node = page.locator(get_tree_node_by_path("users[0]"))
        node.click(button="right")
        page.wait_for_timeout(300)
        page.locator('[data-pydantic-ui="context-menu-duplicate"]').click()
        page.wait_for_timeout(300)

        # Select "After each original item"
        page.locator('[data-pydantic-ui="duplicate-placement-after"]').click()
        page.wait_for_timeout(100)

        page.locator('[data-pydantic-ui="duplicate-confirm"]').click()
        page.wait_for_timeout(500)

        # Should have 3 items: Alice, Alice-copy, Bob
        new_count = count_users_items(page)
        assert new_count == 3

    def test_duplicate_at_end_multi_select(self, page: Page, base_url: str):
        """Test 'at end' placement with multiple selected items.

        Start: Alice(0), Bob(1)
        Duplicate both x2 at end -> Alice, Bob, Alice, Alice, Bob, Bob
        """
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        initial_count = count_users_items(page)
        assert initial_count == 2

        # Ctrl+click to multi-select users[0] and users[1]
        node0 = page.locator(get_tree_node_by_path("users[0]"))
        node1 = page.locator(get_tree_node_by_path("users[1]"))
        node0.click(modifiers=["Control"])
        page.wait_for_timeout(200)
        node1.click(modifiers=["Control"])
        page.wait_for_timeout(200)

        page.keyboard.press("Control+d")
        page.wait_for_timeout(300)

        # Set count to 2
        count_input = page.locator('[data-pydantic-ui="duplicate-count-input"]')
        count_input.fill("2")
        page.wait_for_timeout(100)

        # "At end" is default
        end_radio = page.locator('[data-pydantic-ui="duplicate-placement-end"]')
        expect(end_radio).to_have_attribute("data-state", "checked")

        page.locator('[data-pydantic-ui="duplicate-confirm"]').click()
        page.wait_for_timeout(500)

        # 2 original + 2*2 duplicates = 6
        new_count = count_users_items(page)
        assert new_count == 6

    def test_duplicate_after_each_multi_select(self, page: Page, base_url: str):
        """Test 'after each' placement with multiple selected items.

        Start: Alice(0), Bob(1)
        Duplicate both x1 after each -> Alice, Alice-copy, Bob, Bob-copy
        """
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        initial_count = count_users_items(page)
        assert initial_count == 2

        # Ctrl+click to multi-select users[0] and users[1]
        node0 = page.locator(get_tree_node_by_path("users[0]"))
        node1 = page.locator(get_tree_node_by_path("users[1]"))
        node0.click(modifiers=["Control"])
        page.wait_for_timeout(200)
        node1.click(modifiers=["Control"])
        page.wait_for_timeout(200)

        page.keyboard.press("Control+d")
        page.wait_for_timeout(300)

        # Select "After each original item"
        page.locator('[data-pydantic-ui="duplicate-placement-after"]').click()
        page.wait_for_timeout(100)

        page.locator('[data-pydantic-ui="duplicate-confirm"]').click()
        page.wait_for_timeout(500)

        # 2 original + 2 duplicates = 4, interleaved
        new_count = count_users_items(page)
        assert new_count == 4


class TestDuplicateDialogBehavior:
    """Tests for the duplicate dialog UI behavior."""

    def test_dialog_cancel_does_not_duplicate(self, page: Page, base_url: str):
        """Test that canceling the dialog doesn't create duplicates."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        initial_count = count_users_items(page)

        # Open duplicate dialog
        click_tree_node_by_path(page, "users[0]")
        page.wait_for_timeout(200)
        page.keyboard.press("Control+d")
        page.wait_for_timeout(300)

        # Cancel
        page.locator("button", has_text="Cancel").click()
        page.wait_for_timeout(300)

        # Count should be unchanged
        new_count = count_users_items(page)
        assert new_count == initial_count, (
            f"Expected {initial_count} users after cancel, got {new_count}"
        )

    def test_dialog_closes_on_escape(self, page: Page, base_url: str):
        """Test that pressing Escape closes the dialog without duplicating."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        # Open duplicate dialog
        click_tree_node_by_path(page, "users[0]")
        page.wait_for_timeout(200)
        page.keyboard.press("Control+d")
        page.wait_for_timeout(300)

        dialog = page.locator('[data-pydantic-ui="duplicate-dialog"]')
        expect(dialog).to_be_visible()

        # Press Escape
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        expect(dialog).not_to_be_visible()

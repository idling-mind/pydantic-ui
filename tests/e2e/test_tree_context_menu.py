"""E2E tests for tree context menu workflows (duplicate, delete, clear, paste as new item)."""

import pytest
from playwright.sync_api import Page, expect

from .helpers import (
    click_tree_node_by_path,
    expand_all_tree_nodes,
    get_data_from_api,
    get_tree_node_by_path,
    is_save_button_enabled,
    save_data,
    wait_for_app_load,
)

pytestmark = pytest.mark.e2e


def open_expanded_tree(page: Page, base_url: str) -> None:
    """Open config page and expand all tree nodes."""
    page.goto(f"{base_url}/config")
    wait_for_app_load(page)
    expand_all_tree_nodes(page)
    page.wait_for_timeout(300)


class TestTreeContextMenu:
    """Tests for various context menu operations on tree nodes."""

    def test_context_menu_duplicate_array_item(self, page: Page, base_url: str):
        """Right-clicking an array item and selecting Duplicate opens dialog and creates duplicate."""
        open_expanded_tree(page, base_url)

        user_node = page.locator(get_tree_node_by_path("users[0]")).first
        user_node.click(button="right")
        page.wait_for_timeout(200)

        duplicate_menu_item = page.locator('[data-pydantic-ui="context-menu-duplicate"]').first
        expect(duplicate_menu_item).to_be_visible(timeout=5000)
        duplicate_menu_item.click()

        # Duplicate dialog appears
        duplicate_dialog = page.locator('[role="dialog"]').filter(has_text="Duplicate").first
        expect(duplicate_dialog).to_be_visible(timeout=5000)

        # Confirm duplication (1 copy by default)
        duplicate_dialog.get_by_role("button", name="Duplicate").click()
        page.wait_for_timeout(300)

        assert is_save_button_enabled(page), "Save button should be enabled after duplicating node"
        save_response = save_data(page)
        assert save_response is not None and save_response.status == 200

        api_data = get_data_from_api(page, base_url)
        users = api_data["data"]["users"]
        assert len(users) == 3, f"Expected 3 users after duplicate, got {len(users)}"
        assert users[2]["name"] == users[0]["name"]

    def test_context_menu_delete_array_item(self, page: Page, base_url: str):
        """Right-clicking an array item and selecting Delete Item removes it after confirmation."""
        open_expanded_tree(page, base_url)

        user_node = page.locator(get_tree_node_by_path("users[1]")).first
        user_node.click(button="right")
        page.wait_for_timeout(200)

        delete_menu_item = page.get_by_role("menuitem", name="Delete Item").first
        expect(delete_menu_item).to_be_visible(timeout=5000)
        delete_menu_item.click()

        # Delete confirmation dialog appears
        delete_dialog = page.locator('[role="alertdialog"]').filter(has_text="Delete").first
        expect(delete_dialog).to_be_visible(timeout=5000)

        delete_dialog.get_by_role("button", name="Delete").click()
        page.wait_for_timeout(300)

        assert is_save_button_enabled(page), "Save button should be enabled after deleting item"
        save_response = save_data(page)
        assert save_response is not None and save_response.status == 200

        api_data = get_data_from_api(page, base_url)
        users = api_data["data"]["users"]
        assert len(users) == 1, f"Expected 1 user after deleting second user, got {len(users)}"

    def test_context_menu_clear_field_value(self, page: Page, base_url: str):
        """Right-clicking a field and selecting Clear Value clears the value upon confirmation."""
        open_expanded_tree(page, base_url)

        # Clear tags array
        tags_node = page.locator(get_tree_node_by_path("tags")).first
        tags_node.click(button="right")
        page.wait_for_timeout(200)

        clear_menu_item = page.get_by_role("menuitem", name="Clear Value").first
        expect(clear_menu_item).to_be_visible(timeout=5000)
        clear_menu_item.click()

        clear_dialog = page.locator('[role="alertdialog"]').filter(has_text="Clear").first
        expect(clear_dialog).to_be_visible(timeout=5000)
        clear_dialog.get_by_role("button", name="Clear Value").click()
        page.wait_for_timeout(300)

        assert is_save_button_enabled(page), "Save button should be enabled after clearing value"
        save_response = save_data(page)
        assert save_response is not None and save_response.status == 200

        api_data = get_data_from_api(page, base_url)
        assert api_data["data"].get("tags") == []

    def test_context_menu_paste_as_new_item(self, page: Page, base_url: str):
        """Copying an object and using Paste as New Item on an array appends a new item."""
        open_expanded_tree(page, base_url)

        # Copy owner
        click_tree_node_by_path(page, "owner")
        page.keyboard.press("Control+c")
        page.wait_for_timeout(200)

        # Right click on archived_users array
        archived_array_node = page.locator(get_tree_node_by_path("archived_users")).first
        archived_array_node.click(button="right")
        page.wait_for_timeout(200)

        paste_new_item = page.get_by_role("menuitem", name="Paste as New Item").first
        expect(paste_new_item).to_be_visible(timeout=5000)
        paste_new_item.click()
        page.wait_for_timeout(300)

        assert is_save_button_enabled(page), "Save button should be enabled after paste as new item"
        save_response = save_data(page)
        assert save_response is not None and save_response.status == 200

        api_data = get_data_from_api(page, base_url)
        owner = api_data["data"]["owner"]
        archived = api_data["data"]["archived_users"]
        assert len(archived) == 2, f"Expected 2 archived users, got {len(archived)}"
        assert archived[-1]["name"] == owner["name"]
        assert archived[-1]["email"] == owner["email"]

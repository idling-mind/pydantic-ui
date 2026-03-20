"""E2E tests for copy/paste workflows in the tree view."""

import re

import pytest
from playwright.sync_api import Page, expect

from .helpers import (
    SELECTORS,
    click_tree_node_by_path,
    expand_all_tree_nodes,
    get_data_from_api,
    get_tree_node_by_path,
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


class TestTreeCopyPaste:
    """Tests for object/array copy paste operations from tree interactions."""

    def test_copy_model_and_paste_to_single_tree_target(self, page: Page, base_url: str):
        """Copy one model object and paste it to another compatible tree node."""
        open_expanded_tree(page, base_url)

        click_tree_node_by_path(page, "owner")
        page.keyboard.press("Control+c")
        page.wait_for_timeout(200)

        click_tree_node_by_path(page, "archived_users[0]")
        page.keyboard.press("Control+v")

        paste_dialog = page.locator('[role="alertdialog"]').filter(has_text="Paste to").first
        expect(paste_dialog).to_be_visible(timeout=5000)
        paste_dialog.get_by_role("button", name="Paste").click()
        page.wait_for_timeout(300)

        save_response = save_data(page)
        assert save_response is not None, "Expected save response after tree paste"
        assert save_response.status == 200

        api_data = get_data_from_api(page, base_url)
        owner = api_data["data"]["owner"]
        archived_user = api_data["data"]["archived_users"][0]

        assert archived_user["name"] == owner["name"]
        assert archived_user["email"] == owner["email"]

    def test_multi_select_paste_to_multiple_tree_targets(self, page: Page, base_url: str):
        """Context-menu paste should apply to all multi-selected compatible targets."""
        open_expanded_tree(page, base_url)

        click_tree_node_by_path(page, "owner")
        page.keyboard.press("Control+c")
        page.wait_for_timeout(200)

        users_node = page.locator(get_tree_node_by_path("users[0]")).first
        archived_node = page.locator(get_tree_node_by_path("archived_users[0]")).first

        users_node.click(modifiers=["Control"])
        page.wait_for_timeout(150)
        archived_node.click(modifiers=["Control"])
        page.wait_for_timeout(150)

        tree_panel = page.locator(SELECTORS["tree_panel"]).first
        assert tree_panel.locator(".ring-2").count() >= 2, (
            "Expected at least two multi-selected nodes"
        )

        users_node.click(button="right")
        page.wait_for_timeout(200)

        paste_item = page.get_by_role(
            "menuitem", name=re.compile(r"Paste \(2 targets\)", re.I)
        ).first
        expect(paste_item).to_be_visible(timeout=5000)
        paste_item.click()

        paste_dialog = page.locator('[role="alertdialog"]').filter(has_text="Paste to").first
        expect(paste_dialog).to_be_visible(timeout=5000)
        paste_dialog.get_by_role("button", name="Paste").click()
        page.wait_for_timeout(300)

        save_response = save_data(page)
        assert save_response is not None, "Expected save response after multi-target paste"
        assert save_response.status == 200

        api_data = get_data_from_api(page, base_url)
        owner = api_data["data"]["owner"]
        users_0 = api_data["data"]["users"][0]
        archived_0 = api_data["data"]["archived_users"][0]

        assert users_0["name"] == owner["name"]
        assert users_0["email"] == owner["email"]
        assert archived_0["name"] == owner["name"]
        assert archived_0["email"] == owner["email"]

    def test_copy_array_and_append_via_tree_paste_dialog(self, page: Page, base_url: str):
        """Copying one array and pasting with append mode should merge array items."""
        open_expanded_tree(page, base_url)

        click_tree_node_by_path(page, "users")
        page.keyboard.press("Control+c")
        page.wait_for_timeout(200)

        click_tree_node_by_path(page, "archived_users")
        page.keyboard.press("Control+Shift+v")

        array_dialog = page.locator('[role="dialog"]').filter(has_text="Paste Array Items").first
        expect(array_dialog).to_be_visible(timeout=5000)

        # Append is the default mode. Confirm paste.
        array_dialog.get_by_role("button", name="Paste").click()
        page.wait_for_timeout(300)

        save_response = save_data(page)
        assert save_response is not None, "Expected save response after array append paste"
        assert save_response.status == 200

        api_data = get_data_from_api(page, base_url)
        archived_users = api_data["data"]["archived_users"]
        assert len(archived_users) == 3, (
            f"Expected 3 archived users after appending 2 copied users, got {len(archived_users)}"
        )

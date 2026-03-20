"""E2E tests for duplicate behavior in regular (list) detail view."""

import pytest
from playwright.sync_api import Page, expect

from .helpers import (
    click_tree_node_by_path,
    expand_all_tree_nodes,
    is_save_button_enabled,
    wait_for_app_load,
)

pytestmark = pytest.mark.e2e


def count_users_items(page: Page) -> int:
    """Count top-level users[N] nodes currently visible in the tree."""
    nodes = page.locator("[data-tree-path]")
    count = 0
    for i in range(nodes.count()):
        path = nodes.nth(i).get_attribute("data-tree-path") or ""
        if path.startswith("users[") and "." not in path:
            count += 1
    return count


class TestRegularViewDuplicate:
    """Tests duplicate operations triggered from regular list view controls."""

    def test_can_duplicate_object_item_from_list_view(self, page: Page, base_url: str):
        """Duplicating a row via list-view item menu should create one additional array item."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        click_tree_node_by_path(page, "users")

        # Ensure the users node is expanded so item count is visible in tree.
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        initial_count = count_users_items(page)
        assert initial_count == 2, f"Expected 2 users initially, got {initial_count}"

        detail_content = page.locator('[data-pydantic-ui="detail-content"]').first
        menu_trigger = (
            detail_content.locator("button")
            .filter(has=page.locator("svg.lucide-more-vertical"))
            .first
        )
        expect(menu_trigger).to_be_visible(timeout=5000)
        menu_trigger.click()

        duplicate_item = page.get_by_role("menuitem", name="Duplicate").first
        expect(duplicate_item).to_be_visible(timeout=5000)
        duplicate_item.click()
        page.wait_for_timeout(400)

        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)

        new_count = count_users_items(page)
        assert new_count == initial_count + 1, (
            f"Expected {initial_count + 1} users after list-view duplicate, got {new_count}"
        )
        assert is_save_button_enabled(page), (
            "Save button should be enabled after duplicating from list view"
        )

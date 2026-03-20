"""E2E tests for tree/detail display configuration overrides."""

import pytest
from playwright.sync_api import Page, expect

from .helpers import (
    SELECTORS,
    click_tree_node_by_path,
    get_tree_node_by_path,
    wait_for_app_load,
)

pytestmark = pytest.mark.e2e


class TestDisplayOverrides:
    """Tests for per-view display overrides (tree vs detail)."""

    def test_tree_view_uses_configured_title_override(self, page: Page, base_url: str):
        """Tree node label should use the tree-specific display title when configured."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        panel_metadata_node = page.locator(get_tree_node_by_path("panel_metadata"))
        expect(panel_metadata_node).to_be_visible(timeout=5000)
        expect(panel_metadata_node).to_contain_text("Tree Labels")

    def test_detail_view_uses_configured_title_and_subtitle(self, page: Page, base_url: str):
        """Detail header should use detail-specific title/subtitle override values."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        click_tree_node_by_path(page, "panel_metadata")

        detail_title = page.locator(SELECTORS["detail_title"]).first
        detail_subtitle = page.locator(SELECTORS["detail_subtitle"]).first

        expect(detail_title).to_be_visible(timeout=5000)
        expect(detail_title).to_contain_text("Main Panel Labels")
        expect(detail_subtitle).to_be_visible(timeout=5000)
        expect(detail_subtitle).to_contain_text("Shown in detail panel header")

"""E2E tests for table horizontal scrolling behavior.

These tests verify that:
- The table grid enables horizontal overflow handling.
- A horizontal scrollbar appears when content exceeds available width.
- Users can scroll horizontally across wide table content.
- Checkbox and row-number columns stay pinned at the start.
- UIConfig can pin additional data columns.
"""

import pytest
from playwright.sync_api import Locator, Page, expect

from .helpers import SELECTORS, click_tree_node_by_path, wait_for_app_load

pytestmark = pytest.mark.e2e

TABLE_VIEW_TOGGLE = 'button[title="Table view"]'


def open_users_table_view(page: Page, base_url: str) -> Locator:
    """Navigate to the users array and switch the detail panel to table view."""
    page.goto(f"{base_url}/config")
    wait_for_app_load(page)

    click_tree_node_by_path(page, "users")

    table_toggle = page.locator(TABLE_VIEW_TOGGLE).first
    expect(table_toggle).to_be_visible(timeout=5000)
    table_toggle.click()

    table_grid = page.locator(SELECTORS["table_grid"]).first
    expect(table_grid).to_be_visible(timeout=10000)
    expect(table_grid.locator("revo-grid").first).to_be_visible(timeout=10000)
    return table_grid


def get_grid_metrics(table_grid: Locator) -> dict[str, int | str]:
    """Read basic horizontal scrolling metrics from the table grid wrapper."""
    return table_grid.evaluate(
        """(el) => {
            const style = window.getComputedStyle(el);
            return {
                overflowX: style.overflowX,
                clientWidth: el.clientWidth,
                scrollWidth: el.scrollWidth,
                scrollLeft: el.scrollLeft,
            };
        }"""
    )


def get_pinned_column_props(table_grid: Locator) -> list[str]:
    """Return pinned start-column props from the rendered RevoGrid instance."""
    return table_grid.evaluate(
        """(el) => {
            const grid = el.querySelector('revo-grid');
            if (!grid || !Array.isArray(grid.columns)) {
                return [];
            }

            const flatten = (columns) =>
                columns.flatMap((column) =>
                    Array.isArray(column.children) ? flatten(column.children) : [column]
                );

            return flatten(grid.columns)
                .filter((column) => column && column.pin === 'colPinStart' && column.prop)
                .map((column) => String(column.prop));
        }"""
    )


class TestTableHorizontalScroll:
    """Tests for horizontal overflow and scrolling behavior in table view."""

    def test_table_grid_uses_horizontal_auto_overflow(self, page: Page, base_url: str):
        """Table grid wrapper should enable horizontal scrolling behavior."""
        page.set_viewport_size({"width": 1280, "height": 900})
        table_grid = open_users_table_view(page, base_url)

        metrics = get_grid_metrics(table_grid)

        assert metrics["overflowX"] in (
            "auto",
            "scroll",
        ), f"Expected overflow-x to be auto/scroll, got {metrics['overflowX']}"

    def test_shows_horizontal_overflow_when_content_exceeds_width(self, page: Page, base_url: str):
        """A constrained grid width should expose horizontal overflow for wide content."""
        page.set_viewport_size({"width": 1280, "height": 900})
        table_grid = open_users_table_view(page, base_url)

        # Force a constrained stage to reproduce the overflow scenario deterministically.
        table_grid.evaluate(
            """(el) => {
                el.style.width = '420px';
                el.style.maxWidth = '420px';
            }"""
        )
        page.wait_for_timeout(100)

        metrics = get_grid_metrics(table_grid)

        assert metrics["scrollWidth"] > metrics["clientWidth"], (
            f"Expected overflow (scrollWidth={metrics['scrollWidth']}) to exceed "
            f"clientWidth={metrics['clientWidth']}"
        )

    def test_can_scroll_horizontally_when_overflowing(self, page: Page, base_url: str):
        """Users should be able to move horizontally through overflowing columns."""
        page.set_viewport_size({"width": 1280, "height": 900})
        table_grid = open_users_table_view(page, base_url)

        table_grid.evaluate(
            """(el) => {
                el.style.width = '420px';
                el.style.maxWidth = '420px';
            }"""
        )
        page.wait_for_timeout(100)

        initial_left = table_grid.evaluate("(el) => el.scrollLeft")
        scrolled = table_grid.evaluate(
            """(el) => {
                el.scrollLeft = el.scrollWidth;
                return {
                    scrollLeft: el.scrollLeft,
                    maxScroll: Math.max(0, el.scrollWidth - el.clientWidth),
                };
            }"""
        )

        assert scrolled["maxScroll"] > 0, "Expected positive horizontal scroll range"
        assert scrolled["scrollLeft"] > initial_left, (
            "Expected scrollLeft to increase after scrolling"
        )

    def test_pins_checkbox_and_row_number_columns(self, page: Page, base_url: str):
        """Default meta columns should be pinned on the left side."""
        page.set_viewport_size({"width": 1280, "height": 900})
        table_grid = open_users_table_view(page, base_url)

        page.wait_for_timeout(150)
        pinned_props = get_pinned_column_props(table_grid)

        assert "__check" in pinned_props, "Expected checkbox column to be pinned"
        assert "__displayIndex" in pinned_props, "Expected row number column to be pinned"

    def test_applies_ui_configured_pinned_data_columns(self, page: Page, base_url: str):
        """UIConfig.table_pinned_columns should pin configured data columns."""
        page.set_viewport_size({"width": 1280, "height": 900})
        table_grid = open_users_table_view(page, base_url)

        page.wait_for_timeout(150)
        pinned_props = get_pinned_column_props(table_grid)

        # examples/e2e_test_app.py config pins email explicitly.
        assert "email" in pinned_props, "Expected UIConfig-pinned data column to be pinned"

    def test_wide_layout_does_not_force_unnecessary_horizontal_overflow(
        self, page: Page, base_url: str
    ):
        """With a wide viewport, the grid should not require horizontal overflow."""
        page.set_viewport_size({"width": 1920, "height": 1080})
        table_grid = open_users_table_view(page, base_url)

        metrics = get_grid_metrics(table_grid)

        # +1 allows for sub-pixel rounding differences.
        assert metrics["scrollWidth"] <= metrics["clientWidth"] + 1, (
            f"Expected no horizontal overflow at wide layout, but "
            f"scrollWidth={metrics['scrollWidth']} and clientWidth={metrics['clientWidth']}"
        )

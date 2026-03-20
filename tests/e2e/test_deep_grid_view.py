"""E2E tests for deep nested models in table/grid view."""

from __future__ import annotations

from typing import Any, cast

import pytest
from playwright.sync_api import Locator, Page, expect

from .helpers import (
    SELECTORS,
    click_tree_node_by_path,
    get_data_from_api,
    save_data,
    wait_for_app_load,
)

pytestmark = pytest.mark.e2e

TABLE_VIEW_TOGGLE = 'button[title="Table view"]'


def open_deep_grid_table(page: Page, base_url: str) -> Locator:
    """Open deep_grid_rows in table mode and return the table grid wrapper."""
    page.goto(f"{base_url}/config")
    wait_for_app_load(page)

    click_tree_node_by_path(page, "deep_grid_rows")

    table_toggle = page.locator(TABLE_VIEW_TOGGLE).first
    expect(table_toggle).to_be_visible(timeout=5000)
    table_toggle.click()

    table_grid = page.locator(SELECTORS["table_grid"]).first
    expect(table_grid).to_be_visible(timeout=10000)
    expect(table_grid.locator("revo-grid").first).to_be_visible(timeout=10000)
    return table_grid


def get_leaf_column_props(table_grid: Locator) -> list[str]:
    """Read flattened leaf column props from RevoGrid."""
    props = table_grid.evaluate(
        """(el) => {
            const grid = el.querySelector('revo-grid');
            if (!grid || !Array.isArray(grid.columns)) {
                return [];
            }

            const flatten = (columns) =>
                columns.flatMap((column) =>
                    Array.isArray(column.children) ? flatten(column.children) : [column],
                );

            return flatten(grid.columns)
                .map((column) => column && column.prop)
                .filter((prop) => typeof prop === 'string');
        }"""
    )

    if not isinstance(props, list):
        return []
    return cast(list[str], props)


def get_grid_source(table_grid: Locator) -> list[dict[str, Any]]:
    """Read current RevoGrid source rows as plain dicts."""
    source = table_grid.evaluate(
        """(el) => {
            const grid = el.querySelector('revo-grid');
            if (!grid || !Array.isArray(grid.source)) {
                return [];
            }

            return grid.source.map((row) => {
                if (!row || typeof row !== 'object') {
                    return {};
                }
                return { ...row };
            });
        }"""
    )

    if not isinstance(source, list):
        return []
    return cast(list[dict[str, Any]], source)


def dispatch_table_cell_edit(table_grid: Locator, row_index: int, prop: str, value: Any) -> None:
    """Dispatch the custom table edit event used by table cell templates."""
    table_grid.evaluate(
        """(el, detail) => {
            const grid = el.querySelector('revo-grid');
            if (!grid) {
                return;
            }

            grid.dispatchEvent(
                new CustomEvent('pydantic-ui-cell-edit', {
                    bubbles: true,
                    composed: true,
                    detail,
                }),
            );
        }""",
        {"rowIndex": row_index, "prop": prop, "val": value},
    )


def select_checkbox_by_visible_index(table_grid: Locator, index: int) -> bool:
    """Click a visible checkbox rendered by RevoGrid by visual index."""
    selected = table_grid.evaluate(
        """async (el, checkboxIndex) => {
            const grid = el.querySelector('revo-grid');
            if (!grid) {
                return false;
            }

            const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

            const collectCheckboxes = (root) => {
                const found = [];
                const queue = [root];

                while (queue.length > 0) {
                    const current = queue.shift();
                    if (!current || typeof current.querySelectorAll !== 'function') {
                        continue;
                    }

                    found.push(...Array.from(current.querySelectorAll('input[type="checkbox"]')));

                    const elements = current.querySelectorAll('*');
                    for (const element of elements) {
                        if (element.shadowRoot) {
                            queue.push(element.shadowRoot);
                        }
                    }
                }

                return found;
            };

            for (let attempt = 0; attempt < 12; attempt += 1) {
                const visible = collectCheckboxes(grid.shadowRoot || grid).filter((checkbox) => {
                    const rect = checkbox.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                });

                if (visible.length > 0) {
                    const safeIndex = Math.min(Math.max(checkboxIndex, 0), visible.length - 1);
                    const target = visible[safeIndex];

                    if (!target) {
                        return false;
                    }

                    target.scrollIntoView({ block: 'center', inline: 'center' });
                    target.click();
                    return true;
                }

                await sleep(100);
            }

            return false;
        }""",
        index,
    )

    return bool(selected)


class TestDeepGridTableView:
    """Tests for deep nested table rows in grid view."""

    def test_flattens_deep_nested_columns(self, page: Page, base_url: str):
        """Deep nested models should be flattened into dotted table columns."""
        table_grid = open_deep_grid_table(page, base_url)

        leaf_props = get_leaf_column_props(table_grid)

        assert "service" in leaf_props
        assert "deployment.contact.email" in leaf_props
        assert "deployment.location.zone" in leaf_props
        assert "metrics.latency_ms" in leaf_props

        deployment_columns = [prop for prop in leaf_props if prop.startswith("deployment.")]
        assert len(deployment_columns) >= 6, (
            "Expected several flattened deployment.* columns for deep grid rows"
        )

    def test_edits_nested_column_and_persists(self, page: Page, base_url: str):
        """Editing a deep nested column should persist to the API after save."""
        table_grid = open_deep_grid_table(page, base_url)

        new_email = "deep-grid.owner@example.com"
        dispatch_table_cell_edit(table_grid, 0, "deployment.contact.email", new_email)
        page.wait_for_timeout(300)

        rows_after_edit = get_grid_source(table_grid)
        assert rows_after_edit[0].get("deployment.contact.email") == new_email

        save_response = save_data(page)
        assert save_response is not None, "Expected save response after deep grid edit"
        assert save_response.status == 200

        api_data = get_data_from_api(page, base_url)
        first_row = api_data["data"]["deep_grid_rows"][0]
        assert first_row["deployment"]["contact"]["email"] == new_email

    def test_can_duplicate_selected_row_in_deep_grid(self, page: Page, base_url: str):
        """Deep grid rows should support duplicate operations from table toolbar."""
        table_grid = open_deep_grid_table(page, base_url)

        initial_rows = get_grid_source(table_grid)
        assert len(initial_rows) == 2, f"Expected 2 deep grid rows, got {len(initial_rows)}"

        # Use index=1 to avoid a possible header-level checkbox at index=0.
        assert select_checkbox_by_visible_index(table_grid, 1), (
            "Could not select a row checkbox in deep grid table view"
        )
        page.wait_for_timeout(250)

        duplicate_button = page.locator(SELECTORS["table_duplicate_rows"]).first
        expect(duplicate_button).to_be_visible(timeout=5000)
        expect(duplicate_button).to_contain_text("(1)")
        duplicate_button.click()
        page.wait_for_timeout(300)

        rows_after_duplicate = get_grid_source(table_grid)
        assert len(rows_after_duplicate) == 3, (
            f"Expected 3 rows after duplicate, got {len(rows_after_duplicate)}"
        )

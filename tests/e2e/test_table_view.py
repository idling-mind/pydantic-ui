"""E2E tests for table view interactions.

These tests cover table-specific workflows beyond horizontal scroll behavior:
- Switching between list and table modes for object arrays.
- Row operations (add, duplicate, delete) from the table toolbar.
- Cell edit propagation to UI state and API persistence.
- Row reorder behavior and persistence.
- Column width persistence via localStorage.
"""

from __future__ import annotations

from typing import Any, cast

import pytest
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import Locator, Page, expect

from .helpers import (
    SELECTORS,
    click_tree_node_by_path,
    get_data_from_api,
    is_save_button_enabled,
    save_data,
    wait_for_app_load,
)

pytestmark = pytest.mark.e2e

TABLE_VIEW_TOGGLE = 'button[title="Table view"]'
LIST_VIEW_TOGGLE = 'button[title="List view"]'
TABLE_COLUMN_SIZES_STORAGE_KEY = "pydantic-ui:table-column-sizes:v1:Settings:users"


def goto_config_with_retry(page: Page, base_url: str, *, attempts: int = 3) -> None:
    """Open /config with retries for transient browser navigation errors."""
    url = f"{base_url}/config"
    transient_tokens = (
        "ERR_NETWORK_CHANGED",
        "ERR_ABORTED",
        "ERR_CONNECTION_RESET",
        "ERR_CONNECTION_REFUSED",
    )

    for attempt in range(1, attempts + 1):
        try:
            page.goto(url)
            wait_for_app_load(page)
            return
        except PlaywrightError as exc:
            message = str(exc)
            is_transient = any(token in message for token in transient_tokens)
            if not is_transient or attempt == attempts:
                raise

            # Briefly back off before retrying transient browser/network failures.
            page.wait_for_timeout(250 * attempt)


def open_users_table_view(page: Page, base_url: str) -> Locator:
    """Open the users array in table mode and return the grid wrapper locator."""
    goto_config_with_retry(page, base_url)

    click_tree_node_by_path(page, "users")

    table_toggle = page.locator(TABLE_VIEW_TOGGLE).first
    expect(table_toggle).to_be_visible(timeout=5000)
    table_toggle.click()

    table_view = page.locator(SELECTORS["table_view"]).first
    expect(table_view).to_be_visible(timeout=10000)

    table_grid = page.locator(SELECTORS["table_grid"]).first
    expect(table_grid).to_be_visible(timeout=10000)
    expect(table_grid.locator("revo-grid").first).to_be_visible(timeout=10000)
    return table_grid


def get_grid_source(table_grid: Locator) -> list[dict[str, Any]]:
    """Read the current RevoGrid source rows as plain dicts."""
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
                    const safeIndex = Math.min(
                        Math.max(checkboxIndex, 0),
                        visible.length - 1,
                    );
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


def dispatch_table_cell_edit(table_grid: Locator, row_index: int, prop: str, value: Any) -> None:
    """Dispatch the custom table cell edit event used by cell templates."""
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


def dispatch_row_reorder(table_grid: Locator, from_index: int, to_index: int) -> None:
    """Dispatch a row reorder event from RevoGrid."""
    table_grid.evaluate(
        """(el, detail) => {
            const grid = el.querySelector('revo-grid');
            if (!grid) {
                return;
            }

            grid.dispatchEvent(
                new CustomEvent('roworderchanged', {
                    bubbles: true,
                    composed: true,
                    detail,
                }),
            );
        }""",
        {"from": from_index, "to": to_index},
    )


def dispatch_column_resize(table_grid: Locator, prop: str, size: int) -> None:
    """Dispatch a column resize event with one resized column payload."""
    table_grid.evaluate(
        """(el, payload) => {
            const grid = el.querySelector('revo-grid');
            if (!grid) {
                return;
            }

            grid.dispatchEvent(
                new CustomEvent('aftercolumnresize', {
                    bubbles: true,
                    composed: true,
                    detail: {
                        0: {
                            prop: payload.prop,
                            size: payload.size,
                        },
                    },
                }),
            );
        }""",
        {"prop": prop, "size": size},
    )


def get_column_size(table_grid: Locator, prop: str) -> int | None:
    """Read the current rendered column size for a column prop."""
    size = table_grid.evaluate(
        """(el, targetProp) => {
            const grid = el.querySelector('revo-grid');
            if (!grid || !Array.isArray(grid.columns)) {
                return null;
            }

            const flatten = (columns) =>
                columns.flatMap((column) =>
                    Array.isArray(column.children) ? flatten(column.children) : [column],
                );

            const column = flatten(grid.columns).find(
                (candidate) => candidate && String(candidate.prop) === targetProp,
            );

            return column && typeof column.size === 'number' ? column.size : null;
        }""",
        prop,
    )

    if isinstance(size, (int, float)):
        return int(size)
    return None


class TestTableViewMode:
    """Table/list view switching behavior for array-of-object fields."""

    def test_can_switch_between_list_and_table_views(self, page: Page, base_url: str):
        """The users array should support toggling between list and table modes."""
        goto_config_with_retry(page, base_url)

        click_tree_node_by_path(page, "users")

        list_toggle = page.locator(LIST_VIEW_TOGGLE).first
        table_toggle = page.locator(TABLE_VIEW_TOGGLE).first

        expect(list_toggle).to_be_visible(timeout=5000)
        expect(table_toggle).to_be_visible(timeout=5000)
        expect(page.locator(SELECTORS["table_view"]).first).not_to_be_visible()

        table_toggle.click()
        expect(page.locator(SELECTORS["table_view"]).first).to_be_visible(timeout=10000)

        list_toggle.click()
        expect(page.locator(SELECTORS["table_view"]).first).not_to_be_visible(timeout=5000)


class TestTableViewRowOperations:
    """Row-level table actions (add, duplicate, delete)."""

    def test_add_row_increases_source_count_and_marks_dirty(self, page: Page, base_url: str):
        """Adding a row from the toolbar should increase table source length and enable save."""
        table_grid = open_users_table_view(page, base_url)

        initial_rows = get_grid_source(table_grid)
        assert len(initial_rows) == 2, f"Expected 2 users initially, got {len(initial_rows)}"

        page.locator(SELECTORS["table_add_row"]).first.click()
        page.wait_for_timeout(300)

        rows_after_add = get_grid_source(table_grid)
        assert len(rows_after_add) == 3, f"Expected 3 rows after Add Row, got {len(rows_after_add)}"
        assert is_save_button_enabled(page), "Save should be enabled after adding a row"

    def test_duplicate_selected_row_inserts_a_copy(self, page: Page, base_url: str):
        """Duplicating a selected row should insert one adjacent copy."""
        table_grid = open_users_table_view(page, base_url)

        initial_rows = get_grid_source(table_grid)
        assert len(initial_rows) == 2, f"Expected 2 users initially, got {len(initial_rows)}"

        # Use index=1 to avoid a potential header-level checkbox at index=0.
        assert select_checkbox_by_visible_index(table_grid, 1), (
            "Could not select a row checkbox in table view"
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

        name_email_pairs = [(row.get("name"), row.get("email")) for row in rows_after_duplicate]
        has_adjacent_duplicate = any(
            name_email_pairs[idx] == name_email_pairs[idx + 1]
            for idx in range(len(name_email_pairs) - 1)
        )
        assert has_adjacent_duplicate, "Expected duplicated row values to appear adjacent"

    def test_delete_selected_row_removes_it(self, page: Page, base_url: str):
        """Deleting one selected row should reduce source length by one."""
        table_grid = open_users_table_view(page, base_url)

        initial_rows = get_grid_source(table_grid)
        assert len(initial_rows) == 2, f"Expected 2 users initially, got {len(initial_rows)}"

        assert select_checkbox_by_visible_index(table_grid, 1), (
            "Could not select a row checkbox in table view"
        )
        page.wait_for_timeout(250)

        delete_button = page.locator(SELECTORS["table_delete_rows"]).first
        expect(delete_button).to_be_visible(timeout=5000)
        expect(delete_button).to_contain_text("(1)")
        delete_button.click()
        page.wait_for_timeout(300)

        rows_after_delete = get_grid_source(table_grid)
        assert len(rows_after_delete) == 1, (
            f"Expected 1 row after delete, got {len(rows_after_delete)}"
        )


class TestTableViewEditingAndPersistence:
    """Cell edits and row reorder persistence through save/API."""

    def test_cell_edit_event_updates_email_and_persists(self, page: Page, base_url: str):
        """Editing a table cell should update local state and persist after save."""
        table_grid = open_users_table_view(page, base_url)

        new_email = "alice.table-view.e2e@example.com"
        dispatch_table_cell_edit(table_grid, row_index=0, prop="email", value=new_email)
        page.wait_for_timeout(250)

        rows_after_edit = get_grid_source(table_grid)
        assert rows_after_edit[0].get("email") == new_email
        assert is_save_button_enabled(page), "Save should be enabled after table cell edit"

        save_response = save_data(page)
        assert save_response is not None, "Expected save response after table cell edit"
        assert save_response.status == 200

        api_data = get_data_from_api(page, base_url)
        users = api_data["data"]["users"]
        assert users[0]["email"] == new_email

    def test_numeric_edit_coerces_string_to_integer(self, page: Page, base_url: str):
        """Numeric table edits should coerce string payloads to numbers."""
        table_grid = open_users_table_view(page, base_url)

        dispatch_table_cell_edit(table_grid, row_index=0, prop="age", value="41")
        page.wait_for_timeout(250)

        age_info = table_grid.evaluate(
            """(el) => {
                const grid = el.querySelector('revo-grid');
                if (!grid || !Array.isArray(grid.source) || grid.source.length === 0) {
                    return { value: null, valueType: 'undefined' };
                }
                const value = grid.source[0].age;
                return { value, valueType: typeof value };
            }"""
        )

        assert age_info["value"] == 41
        assert age_info["valueType"] == "number"

        save_response = save_data(page)
        assert save_response is not None, "Expected save response after numeric cell edit"
        assert save_response.status == 200

        api_data = get_data_from_api(page, base_url)
        age_value = api_data["data"]["users"][0]["age"]
        assert isinstance(age_value, int)
        assert age_value == 41

    def test_row_reorder_changes_order_and_persists(self, page: Page, base_url: str):
        """Reordering rows should update source order and persist through save."""
        table_grid = open_users_table_view(page, base_url)

        before_rows = get_grid_source(table_grid)
        assert len(before_rows) >= 2, "Need at least two rows to test reorder"

        first_email = before_rows[0].get("email")
        second_email = before_rows[1].get("email")
        assert first_email != second_email, "Fixture should have distinct first two rows"

        dispatch_row_reorder(table_grid, from_index=0, to_index=1)
        page.wait_for_timeout(250)

        after_rows = get_grid_source(table_grid)
        assert after_rows[0].get("email") == second_email
        assert after_rows[1].get("email") == first_email

        save_response = save_data(page)
        assert save_response is not None, "Expected save response after row reorder"
        assert save_response.status == 200

        api_data = get_data_from_api(page, base_url)
        users = api_data["data"]["users"]
        assert users[0]["email"] == second_email
        assert users[1]["email"] == first_email


class TestTableViewColumnSizing:
    """Column width persistence behavior."""

    def test_column_resize_persists_in_local_storage_and_reload(self, page: Page, base_url: str):
        """Resized table column widths should persist and re-apply after reload."""
        table_grid = open_users_table_view(page, base_url)

        # Ensure this test starts from a clean storage payload.
        page.evaluate(
            """(storageKey) => {
                localStorage.removeItem(storageKey);
            }""",
            TABLE_COLUMN_SIZES_STORAGE_KEY,
        )

        dispatch_column_resize(table_grid, prop="email", size=260)
        page.wait_for_timeout(250)

        stored_size = page.evaluate(
            """([storageKey, prop]) => {
                const raw = localStorage.getItem(storageKey);
                if (!raw) {
                    return null;
                }

                try {
                    const parsed = JSON.parse(raw);
                    return typeof parsed?.[prop] === 'number' ? parsed[prop] : null;
                } catch {
                    return null;
                }
            }""",
            [TABLE_COLUMN_SIZES_STORAGE_KEY, "email"],
        )
        assert stored_size == 260, f"Expected localStorage width 260, got {stored_size}"

        # Re-open table mode in a fresh navigation and confirm width is re-applied.
        reopened_grid = open_users_table_view(page, base_url)
        reopened_email_size = get_column_size(reopened_grid, "email")
        assert reopened_email_size == 260, (
            f"Expected reopened email column width 260, got {reopened_email_size}"
        )

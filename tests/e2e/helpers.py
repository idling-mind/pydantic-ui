"""
Common utilities and helpers for E2E tests.

Provides reusable functions for:
- Waiting for API responses
- Finding and interacting with UI elements
- Common assertions

All selectors use data-pydantic-ui attributes for stability.
"""

import re
from typing import Any, Literal

from playwright.sync_api import Page, Response, expect

# =============================================================================
# Core Selectors - Based on actual frontend implementation
# =============================================================================

SELECTORS = {
    # Layout
    "app_container": '[data-pydantic-ui="app-container"]',
    "tree_panel_container": '[data-pydantic-ui="tree-panel-container"]',
    "detail_panel_container": '[data-pydantic-ui="detail-panel-container"]',
    "resize_handle": '[data-pydantic-ui="resize-handle"]',
    # Header
    "header": '[data-pydantic-ui="header"]',
    "header_logo_title": '[data-pydantic-ui="header-logo-title"]',
    "header_logo": '[data-pydantic-ui="header-logo"]',
    "header_title": '[data-pydantic-ui="header-title"]',
    "theme_toggle": '[data-pydantic-ui="theme-toggle"]',
    # Tree Panel
    "tree_panel": '[data-pydantic-ui="tree-panel"]',
    "tree_search_container": '[data-pydantic-ui="tree-search-container"]',
    "tree_search": '[data-pydantic-ui="tree-search"]',
    "tree_toolbar": '[data-pydantic-ui="tree-toolbar"]',
    "tree_filter_simple": '[data-pydantic-ui="tree-filter-simple"]',
    "tree_toggle_types": '[data-pydantic-ui="tree-toggle-types"]',
    "tree_actions": '[data-pydantic-ui="tree-actions"]',
    "tree_expand_all": '[data-pydantic-ui="tree-expand-all"]',
    "tree_collapse_all": '[data-pydantic-ui="tree-collapse-all"]',
    "tree_up_level": '[data-pydantic-ui="tree-up-level"]',
    "tree_content": '[data-pydantic-ui="tree-content"]',
    "tree_node": '[data-pydantic-ui="tree-node"]',
    # Detail Panel
    "detail_panel": '[data-pydantic-ui="detail-panel"]',
    "detail_header": '[data-pydantic-ui="detail-header"]',
    "detail_title": '[data-pydantic-ui="detail-title"]',
    "detail_subtitle": '[data-pydantic-ui="detail-subtitle"]',
    "detail_path": '[data-pydantic-ui="detail-path"]',
    "detail_content": '[data-pydantic-ui="detail-content"]',
    "detail_footer": '[data-pydantic-ui="detail-footer"]',
    "unsaved_indicator": '[data-pydantic-ui="unsaved-indicator"]',
    "save_reset_buttons": '[data-pydantic-ui="save-reset-buttons"]',
    "save_button": '[data-pydantic-ui="save-button"]',
    "reset_button": '[data-pydantic-ui="reset-button"]',
    # Fields
    "field": '[data-pydantic-ui="field"]',
    "field_label": '[data-pydantic-ui="field-label"]',
    "field_control": '[data-pydantic-ui="field-control"]',
    "field_subtitle": '[data-pydantic-ui="field-subtitle"]',
    # Nested Cards
    "nested_card": '[data-pydantic-ui="nested-card"]',
    # Table View
    "table_view": '[data-pydantic-ui="table-view"]',
    "table_toolbar": '[data-pydantic-ui="table-toolbar"]',
    "table_add_row": '[data-pydantic-ui="table-add-row"]',
    "table_duplicate_rows": '[data-pydantic-ui="table-duplicate-rows"]',
    "table_delete_rows": '[data-pydantic-ui="table-delete-rows"]',
    "table_grid": '[data-pydantic-ui="table-grid"]',
}


def get_selector(key: str) -> str:
    """Get a selector by key."""
    return SELECTORS.get(key, f'[data-pydantic-ui="{key}"]')


def get_field_by_type(field_type: str) -> str:
    """Get selector for field by type."""
    return f'[data-pydantic-ui-field-type="{field_type}"]'


def get_field_by_path(path: str) -> str:
    """Get selector for field by path."""
    return f'[data-pydantic-ui-path="{path}"]'


def get_tree_node_by_path(path: str) -> str:
    """Get selector for tree node by path."""
    return f'[data-pydantic-ui="tree-node"][data-pydantic-ui-path="{path}"]'


# =============================================================================
# UI Element Helpers
# =============================================================================


def wait_for_selector(page: Page, selector_key: str, timeout: int = 10000):
    """Wait for a selector to be visible and return the locator.

    Args:
        page: Playwright page
        selector_key: Key from SELECTORS dict or a CSS selector
        timeout: Maximum wait time in milliseconds

    Returns:
        The locator for the element
    """
    selector = SELECTORS.get(selector_key, selector_key)
    locator = page.locator(selector).first
    locator.wait_for(state="visible", timeout=timeout)
    return locator


def get_ui_item(page: Page, name_pattern: str, timeout: int = 10000):
    """Get UI element by data-pydantic-ui attribute value and wait for it."""
    selector = SELECTORS.get(name_pattern, f'[data-pydantic-ui="{name_pattern}"]')
    locator = page.locator(selector).first
    locator.wait_for(state="visible", timeout=timeout)
    return locator


def wait_for_app_load(page: Page, timeout: int = 15000) -> None:
    """Wait for the app to fully load by waiting for key UI elements.

    This waits for actual DOM elements rather than network idle state,
    which is more reliable for determining when the UI is ready.
    """
    # Wait for the main layout container
    page.locator(SELECTORS["app_container"]).wait_for(state="visible", timeout=timeout)

    # Wait for tree panel with at least one node
    page.locator(SELECTORS["tree_panel"]).wait_for(state="visible", timeout=timeout)
    page.locator(SELECTORS["tree_node"]).first.wait_for(state="visible", timeout=timeout)

    # Wait for detail panel
    page.locator(SELECTORS["detail_panel"]).wait_for(state="visible", timeout=timeout)


def wait_for_tree_loaded(page: Page, timeout: int = 10000) -> None:
    """Wait for tree panel to be loaded with at least one node."""
    page.locator(SELECTORS["tree_panel"]).wait_for(state="visible", timeout=timeout)
    page.locator(SELECTORS["tree_node"]).first.wait_for(state="visible", timeout=timeout)


def wait_for_detail_loaded(page: Page, timeout: int = 10000) -> None:
    """Wait for detail panel to be loaded with content."""
    page.locator(SELECTORS["detail_panel"]).wait_for(state="visible", timeout=timeout)
    page.locator(SELECTORS["detail_content"]).wait_for(state="visible", timeout=timeout)


# =============================================================================
# Tree Navigation
# =============================================================================


def click_tree_node(page: Page, name_pattern: str | re.Pattern) -> None:
    """Find and click a tree node by name or pattern."""
    node = page.locator(SELECTORS["tree_node"]).filter(has_text=name_pattern).first
    node.wait_for(state="visible", timeout=5000)
    node.click()
    page.wait_for_timeout(300)


def click_tree_node_by_path(page: Page, path: str) -> None:
    """Click a tree node by its data path."""
    selector = get_tree_node_by_path(path)
    node = page.locator(selector).first
    node.wait_for(state="visible", timeout=5000)
    node.click()
    page.wait_for_timeout(300)


def expand_tree_node(page: Page, name_pattern: str | re.Pattern) -> None:
    """Expand a tree node if it's collapsible."""
    node = page.locator(SELECTORS["tree_node"]).filter(has_text=name_pattern).first
    node.wait_for(state="visible", timeout=5000)

    # Check if node is expandable (has data-pydantic-ui-expanded attribute)
    is_expanded = node.get_attribute("data-pydantic-ui-expanded")

    if is_expanded == "false":
        # Click the expand trigger (chevron button inside the node)
        expand_btn = node.locator("button").first
        if expand_btn.is_visible():
            expand_btn.click()
            page.wait_for_timeout(300)


def collapse_tree_node(page: Page, name_pattern: str | re.Pattern) -> None:
    """Collapse a tree node if it's expanded."""
    node = page.locator(SELECTORS["tree_node"]).filter(has_text=name_pattern).first
    node.wait_for(state="visible", timeout=5000)

    is_expanded = node.get_attribute("data-pydantic-ui-expanded")

    if is_expanded == "true":
        expand_btn = node.locator("button").first
        if expand_btn.is_visible():
            expand_btn.click()
            page.wait_for_timeout(300)


def expand_all_tree_nodes(page: Page, timeout: int = 5000) -> None:
    """Click the expand all button."""
    btn = page.locator(SELECTORS["tree_expand_all"])
    btn.wait_for(state="visible", timeout=timeout)
    btn.click()
    page.wait_for_timeout(300)


def collapse_all_tree_nodes(page: Page, timeout: int = 5000) -> None:
    """Click the collapse all button."""
    btn = page.locator(SELECTORS["tree_collapse_all"])
    btn.wait_for(state="visible", timeout=timeout)
    btn.click()
    page.wait_for_timeout(300)


def get_tree_node_count(page: Page) -> int:
    """Get the number of visible tree nodes."""
    return page.locator(SELECTORS["tree_node"]).count()


def is_tree_node_selected(page: Page, name_pattern: str | re.Pattern) -> bool:
    """Check if a tree node is selected."""
    node = page.locator(SELECTORS["tree_node"]).filter(has_text=name_pattern).first
    return node.get_attribute("data-pydantic-ui-selected") == "true"


def is_tree_node_expanded(page: Page, name_pattern: str | re.Pattern) -> bool:
    """Check if a tree node is expanded."""
    node = page.locator(SELECTORS["tree_node"]).filter(has_text=name_pattern).first
    return node.get_attribute("data-pydantic-ui-expanded") == "true"


# =============================================================================
# Field Helpers
# =============================================================================


def get_field_by_type_locator(page: Page, field_type: str):
    """Get locator for fields of a specific type."""
    return page.locator(get_field_by_type(field_type))


def get_field_by_path_locator(page: Page, path: str):
    """Get locator for field by path."""
    return page.locator(get_field_by_path(path))


def get_field_input(page: Page, path: str):
    """Get the input/control element within a field."""
    field = page.locator(get_field_by_path(path))
    return field.locator('[data-pydantic-ui="field-control"]').first


def get_first_field_of_type(page: Page, field_type: str):
    """Get the first visible field of a specific type."""
    return page.locator(get_field_by_type(field_type)).first


def get_first_input(page: Page, input_type: str):
    """Get the first visible input of a specific type."""
    input_elem = page.locator(f'input[type="{input_type}"]').first
    input_elem.wait_for(state="visible", timeout=5000)
    return input_elem


def fill_text_field(page: Page, path: str, value: str) -> None:
    """Fill a text field by path."""
    field = get_field_by_path_locator(page, path)
    input_el = field.locator("input, textarea").first
    input_el.click()
    input_el.fill(value)
    page.wait_for_timeout(100)


def fill_number_field(page: Page, path: str, value: int | float) -> None:
    """Fill a number field by path."""
    field = get_field_by_path_locator(page, path)
    input_el = field.locator("input[type='number']").first
    input_el.click()
    input_el.fill(str(value))
    page.wait_for_timeout(100)


def toggle_boolean_field(page: Page, path: str) -> None:
    """Toggle a boolean field (switch or checkbox) by path."""
    field = get_field_by_path_locator(page, path)
    control = field.locator('[role="switch"], input[type="checkbox"]').first
    control.click()
    page.wait_for_timeout(100)


def select_option(page: Page, path: str, value: str) -> None:
    """Select an option in a select field by path."""
    field = get_field_by_path_locator(page, path)

    # For native select
    native_select = field.locator("select")
    if native_select.count() > 0:
        native_select.select_option(value)
        return

    # For shadcn/ui Select (combobox)
    trigger = field.locator('[role="combobox"]').first
    trigger.click()
    page.wait_for_timeout(200)

    # Click the option
    option = page.locator('[role="option"]').filter(has_text=value).first
    option.click()
    page.wait_for_timeout(100)


# =============================================================================
# Save/Reset Operations
# =============================================================================


def save_data(page: Page, wait_for_response: bool = True) -> Response | None:
    """Save data and wait for the operation to complete."""
    save_button = page.locator(SELECTORS["save_button"])
    save_button.wait_for(state="visible", timeout=5000)

    if save_button.is_disabled():
        raise RuntimeError("Save button is disabled - no changes to save")

    if wait_for_response:
        with page.expect_response(
            lambda response: "/api/data" in response.url
            and response.request.method in ("POST", "PUT", "PATCH"),
            timeout=10000,
        ) as response_info:
            save_button.click()

        try:
            return response_info.value
        except Exception:
            page.wait_for_timeout(1000)
            return None
    else:
        save_button.click()
        page.wait_for_timeout(500)
        return None


def reset_data(page: Page) -> None:
    """Reset data to original values."""
    reset_button = page.locator(SELECTORS["reset_button"])
    reset_button.wait_for(state="visible", timeout=5000)

    if reset_button.is_disabled():
        raise RuntimeError("Reset button is disabled - no changes to reset")

    reset_button.click()
    page.wait_for_timeout(500)


def is_save_button_enabled(page: Page) -> bool:
    """Check if save button is enabled."""
    save_button = page.locator(SELECTORS["save_button"])
    return save_button.is_visible() and not save_button.is_disabled()


def is_reset_button_enabled(page: Page) -> bool:
    """Check if reset button is enabled."""
    reset_button = page.locator(SELECTORS["reset_button"])
    return reset_button.is_visible() and not reset_button.is_disabled()


def has_unsaved_changes(page: Page) -> bool:
    """Check if there are unsaved changes indicator."""
    indicator = page.locator(SELECTORS["unsaved_indicator"])
    return indicator.is_visible()


# =============================================================================
# Theme Helpers
# =============================================================================


def switch_theme(page: Page, mode: Literal["light", "dark", "system"]) -> None:
    """Switch theme to specified mode."""
    theme_toggle = page.locator(SELECTORS["theme_toggle"])

    theme_toggle.wait_for(state="visible", timeout=5000)
    theme_toggle.click()
    page.wait_for_timeout(300)

    option = page.get_by_text(re.compile(f"^{mode}$", re.I))
    option.wait_for(state="visible", timeout=5000)
    option.click()
    page.wait_for_timeout(500)


def is_dark_mode(page: Page) -> bool:
    """Check if app is in dark mode."""
    html = page.locator("html")
    class_name = html.get_attribute("class")
    return "dark" in (class_name or "")


# =============================================================================
# Validation Helpers
# =============================================================================


def has_validation_error(_page: Page, input_locator) -> bool:
    """Check if an element has a validation error."""
    # Check for error message nearby
    parent = input_locator.locator("..").locator("..")
    error_text = parent.locator("text=/error|invalid|required/i")
    return error_text.count() > 0


def wait_for_toast(page: Page, text_pattern: str | re.Pattern | None = None):
    """Wait for toast/notification message."""
    if text_pattern:
        toast = page.locator('[role="status"], [data-testid="toast"]').filter(has_text=text_pattern)
    else:
        toast = page.locator('[role="status"], [data-testid="toast"]').first

    try:
        toast.wait_for(state="visible", timeout=5000)
        return toast
    except Exception:
        return None


# =============================================================================
# API Helpers
# =============================================================================


def get_config_from_api(page: Page, base_url: str) -> dict[str, Any]:
    """Get config from API via fetch."""
    return page.evaluate(f"""
        async () => {{
            const response = await fetch('{base_url}/config/api/config');
            return await response.json();
        }}
    """)


def get_schema_from_api(page: Page, base_url: str) -> dict[str, Any]:
    """Get schema from API via fetch."""
    return page.evaluate(f"""
        async () => {{
            const response = await fetch('{base_url}/config/api/schema');
            return await response.json();
        }}
    """)


def get_data_from_api(page: Page, base_url: str) -> dict[str, Any]:
    """Get data from API via fetch."""
    return page.evaluate(f"""
        async () => {{
            const response = await fetch('{base_url}/config/api/data');
            return await response.json();
        }}
    """)


# =============================================================================
# Utility Functions
# =============================================================================


def count_elements(page: Page, selector_key: str) -> int:
    """Count elements matching selector key."""
    selector = get_selector(selector_key)
    return page.locator(selector).count()


def count_visible(page: Page, selector: str) -> int:
    """Count visible elements matching selector."""
    elements = page.locator(selector).all()
    count = 0
    for el in elements:
        if el.is_visible():
            count += 1
    return count


def fill_input_debounced(page: Page, input_elem, value: str, debounce_ms: int = 300) -> None:
    """Fill an input and wait for debounce."""
    input_elem.click()
    input_elem.fill(value)
    page.wait_for_timeout(debounce_ms)


def verify_no_console_errors(page: Page, ignore_patterns: list[str] | None = None) -> list[str]:
    """Collect console errors, filtering out expected ones."""
    if ignore_patterns is None:
        ignore_patterns = ["favicon", "404", "DevTools"]

    errors: list[str] = []

    def handle_console(msg):
        if msg.type == "error":
            text = msg.text
            if not any(pattern in text for pattern in ignore_patterns):
                errors.append(text)

    page.on("console", handle_console)
    return errors


def screenshot(page: Page, name: str) -> None:
    """Take a screenshot with a descriptive name."""
    page.screenshot(path=f"test-results/screenshots/{name}.png", full_page=True)


def assert_visible(page: Page, selector_or_key: str, message: str | None = None) -> None:
    """Assert element exists and is visible by selector or selector key."""
    # Check if it's a key in SELECTORS
    if selector_or_key in SELECTORS:
        selector = SELECTORS[selector_or_key]
    elif selector_or_key.startswith("["):
        selector = selector_or_key
    else:
        selector = get_selector(selector_or_key)
    element = page.locator(selector).first
    expect(element, message).to_be_visible(timeout=5000)


def assert_not_visible(page: Page, selector_or_key: str, message: str | None = None) -> None:
    """Assert element does not exist or is not visible."""
    if selector_or_key in SELECTORS:
        selector = SELECTORS[selector_or_key]
    elif selector_or_key.startswith("["):
        selector = selector_or_key
    else:
        selector = get_selector(selector_or_key)
    element = page.locator(selector).first
    expect(element, message).not_to_be_visible(timeout=2000)


def assert_field_value(page: Page, path: str, expected_value: str) -> None:
    """Assert a field has the expected value."""
    field = get_field_by_path_locator(page, path)
    input_el = field.locator("input, textarea, select").first
    expect(input_el).to_have_value(expected_value)


def assert_field_visible(page: Page, path: str) -> None:
    """Assert a field is visible by path."""
    field = get_field_by_path_locator(page, path)
    expect(field).to_be_visible(timeout=5000)

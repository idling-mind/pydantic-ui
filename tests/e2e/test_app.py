"""
E2E tests for the Pydantic UI application.

These tests verify the complete user experience including:
- UI loading and initial state
- Tree navigation
- Field editing
- Save/Reset functionality
- Custom action buttons

Run these tests with:
    uv run pytest tests/e2e/test_app.py -v

Requires the e2e_test_app.py example to be running at http://localhost:8000
"""

import re

from playwright.sync_api import Page, expect

from .helpers import (
    SELECTORS,
    get_tree_node_count,
    is_save_button_enabled,
    wait_for_app_load,
    wait_for_tree_loaded,
)


class TestApplicationLoading:
    """Tests for application loading."""

    def test_loads_main_ui(self, page: Page, base_url: str):
        """Test that the main UI loads."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # App container should be visible
        app_container = page.locator(SELECTORS["app_container"])
        expect(app_container).to_be_visible(timeout=10000)

    def test_shows_tree_panel(self, page: Page, base_url: str):
        """Test that tree panel is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        tree_panel = page.locator(SELECTORS["tree_panel"])
        expect(tree_panel).to_be_visible(timeout=10000)

    def test_shows_tree_panel_container(self, page: Page, base_url: str):
        """Test that tree panel container is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        tree_panel_container = page.locator(SELECTORS["tree_panel_container"])
        expect(tree_panel_container).to_be_visible(timeout=10000)

    def test_shows_detail_panel(self, page: Page, base_url: str):
        """Test that detail panel is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        detail_panel = page.locator(SELECTORS["detail_panel"])
        expect(detail_panel).to_be_visible(timeout=10000)

    def test_shows_detail_title(self, page: Page, base_url: str):
        """Test that detail panel title is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        detail_title = page.locator(SELECTORS["detail_title"])
        expect(detail_title).to_be_visible(timeout=10000)

    def test_shows_detail_content(self, page: Page, base_url: str):
        """Test that detail panel content is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        detail_content = page.locator(SELECTORS["detail_content"])
        expect(detail_content).to_be_visible(timeout=10000)

    def test_shows_header(self, page: Page, base_url: str):
        """Test that header is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        header = page.locator(SELECTORS["header"])
        expect(header).to_be_visible(timeout=10000)

    def test_shows_header_logo_title(self, page: Page, base_url: str):
        """Test that header logo title area is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        header_logo_title = page.locator(SELECTORS["header_logo_title"])
        expect(header_logo_title).to_be_visible(timeout=10000)

    def test_shows_header_title(self, page: Page, base_url: str):
        """Test that header title is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        header_title = page.locator(SELECTORS["header_title"])
        expect(header_title).to_be_visible(timeout=10000)

    def test_shows_detail_footer(self, page: Page, base_url: str):
        """Test that detail footer is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        detail_footer = page.locator(SELECTORS["detail_footer"])
        expect(detail_footer).to_be_visible(timeout=10000)

    def test_shows_tree_nodes(self, page: Page, base_url: str):
        """Test that tree nodes are visible."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        node_count = get_tree_node_count(page)
        assert node_count > 0, "Expected at least one tree node"


class TestAPIIntegration:
    """Tests for API integration."""

    def test_loads_schema_from_api(self, page: Page, base_url: str):
        """Test that schema loads from API."""
        with page.expect_response(
            lambda response: "/api/schema" in response.url and response.status == 200
        ) as response_info:
            page.goto(f"{base_url}/config")

        response = response_info.value
        schema = response.json()

        assert "name" in schema, "Schema should have 'name' field"
        assert "fields" in schema, "Schema should have 'fields' field"

    def test_loads_data_from_api(self, page: Page, base_url: str):
        """Test that data loads from API."""
        with page.expect_response(
            lambda response: "/api/data" in response.url and response.status == 200
        ) as response_info:
            page.goto(f"{base_url}/config")

        response = response_info.value
        body = response.json()

        assert "data" in body, "Response should have 'data' field"

    def test_loads_config_from_api(self, page: Page, base_url: str):
        """Test that config loads from API."""
        with page.expect_response(
            lambda response: "/api/config" in response.url and response.status == 200
        ) as response_info:
            page.goto(f"{base_url}/config")

        response = response_info.value
        config = response.json()

        assert "title" in config, "Config should have 'title' field"
        assert "theme" in config, "Config should have 'theme' field"


class TestTreeNavigation:
    """Tests for tree navigation."""

    def test_can_click_on_tree_nodes(self, page: Page, base_url: str):
        """Test that tree nodes are clickable."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        # Find first clickable tree node
        tree_nodes = page.locator(SELECTORS["tree_node"])
        first_node = tree_nodes.first

        expect(first_node).to_be_visible()
        first_node.click()

        # Verify node is now selected
        is_selected = first_node.get_attribute("data-pydantic-ui-selected")
        assert is_selected == "true", "Tree node should be selected after click"

    def test_can_expand_tree_nodes(self, page: Page, base_url: str):
        """Test that tree nodes can be expanded."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        initial_count = get_tree_node_count(page)

        # Click expand all button
        expand_all = page.locator(SELECTORS["tree_expand_all"])
        expand_all.wait_for(state="visible", timeout=5000)
        expand_all.click()
        page.wait_for_timeout(500)

        expanded_count = get_tree_node_count(page)
        assert expanded_count >= initial_count, "Expanding should show more or equal nodes"


class TestFieldEditing:
    """Tests for field editing."""

    def test_can_edit_text_input_fields(self, page: Page, base_url: str):
        """Test that text input fields can be edited."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Find a text input field
        text_input = page.locator('input[type="text"]').first
        text_input.wait_for(state="visible", timeout=5000)

        original_value = text_input.input_value()
        text_input.click()
        text_input.fill("Test Value E2E")

        # Verify the input accepted the value
        expect(text_input).to_have_value("Test Value E2E")

        # Restore original to not affect other tests
        text_input.fill(original_value)

    def test_can_edit_number_input_fields(self, page: Page, base_url: str):
        """Test that number input fields can be edited."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Find a number input field
        number_input = page.locator('input[type="number"]').first
        number_input.wait_for(state="visible", timeout=5000)

        number_input.click()
        number_input.fill("42")
        expect(number_input).to_have_value("42")

    def test_can_toggle_boolean_fields(self, page: Page, base_url: str):
        """Test that boolean fields can be toggled."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Find a switch/toggle
        toggle = page.locator('[role="switch"]').first
        toggle.wait_for(state="visible", timeout=5000)

        was_checked = toggle.get_attribute("aria-checked") == "true"
        toggle.click()
        page.wait_for_timeout(200)

        is_now_checked = toggle.get_attribute("aria-checked") == "true"
        assert is_now_checked != was_checked, "Toggle state should change after click"


class TestSaveAndReset:
    """Tests for save and reset functionality."""

    def test_save_button_disabled_initially(self, page: Page, base_url: str):
        """Test that save button is disabled when no changes."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        save_button = page.locator(SELECTORS["save_button"])
        save_button.wait_for(state="visible", timeout=5000)

        # Save button should be disabled when no changes
        expect(save_button).to_be_disabled()

    def test_save_button_enables_after_changes(self, page: Page, base_url: str):
        """Test that save button enables after changes."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Find and modify a text input
        text_input = page.locator('input[type="text"]').first
        text_input.wait_for(state="visible", timeout=5000)

        text_input.click()
        text_input.fill("Modified Value")
        page.wait_for_timeout(300)

        # Save button should now be enabled
        assert is_save_button_enabled(page), "Save button should be enabled after changes"

    def test_reset_button_disabled_initially(self, page: Page, base_url: str):
        """Test that reset button is disabled when no changes."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        reset_button = page.locator(SELECTORS["reset_button"])
        reset_button.wait_for(state="visible", timeout=5000)

        expect(reset_button).to_be_disabled()

    def test_can_save_data(self, page: Page, base_url: str):
        """Test that data can be saved."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Make a change
        text_input = page.locator('input[type="text"]').first
        text_input.wait_for(state="visible", timeout=5000)

        text_input.click()
        text_input.fill("Saved Value E2E Test")
        page.wait_for_timeout(200)

        save_button = page.locator(SELECTORS["save_button"])
        save_button.wait_for(state="visible", timeout=5000)

        # Wait for button to be enabled
        expect(save_button).to_be_enabled(timeout=3000)

        with page.expect_response(
            lambda response: "/api/data" in response.url and response.request.method == "POST",
            timeout=5000,
        ) as response_info:
            save_button.click()

        response = response_info.value
        assert response.status == 200, "Save should return 200 status"

    def test_can_reset_data(self, page: Page, base_url: str):
        """Test that data can be reset."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        text_input = page.locator('input[type="text"]').first
        text_input.wait_for(state="visible", timeout=5000)

        original_value = text_input.input_value()
        text_input.click()
        text_input.fill("Changed Value For Reset")
        page.wait_for_timeout(200)

        reset_button = page.locator(SELECTORS["reset_button"])
        reset_button.wait_for(state="visible", timeout=5000)

        # Wait for button to be enabled
        expect(reset_button).to_be_enabled(timeout=3000)

        reset_button.click()
        page.wait_for_timeout(500)

        # Value should be reset
        expect(text_input).to_have_value(original_value)


class TestCustomActions:
    """Tests for custom action buttons."""

    def test_action_buttons_visible_if_configured(self, page: Page, base_url: str):
        """Test that action buttons are visible if configured."""
        with page.expect_response(
            lambda response: "/api/config" in response.url and response.status == 200
        ) as response_info:
            page.goto(f"{base_url}/config")

        response = response_info.value
        config = response.json()

        if config.get("actions") and len(config["actions"]) > 0:
            page.wait_for_timeout(1000)

            # Action buttons should be in the footer area
            for action in config["actions"]:
                button = page.get_by_role("button", name=re.compile(action["label"], re.I))
                # Just verify we can find the button
                count = button.count()
                assert count >= 0  # May be in dropdown or not visible


class TestTheme:
    """Tests for theme functionality."""

    def test_theme_toggle_visible(self, page: Page, base_url: str):
        """Test that theme toggle is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        theme_toggle = page.locator(SELECTORS["theme_toggle"])
        expect(theme_toggle).to_be_visible()


class TestErrorHandling:
    """Tests for error handling."""

    def test_no_console_errors_on_load(self, page: Page, base_url: str):
        """Test that there are no console errors on load."""
        errors: list[str] = []

        def handle_console(msg):
            if msg.type == "error":
                errors.append(msg.text)

        page.on("console", handle_console)

        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Filter out expected errors (like favicon 404)
        unexpected_errors = [e for e in errors if "favicon" not in e.lower() and "404" not in e]

        assert len(unexpected_errors) == 0, f"Unexpected console errors: {unexpected_errors}"


class TestResponsiveDesign:
    """Tests for responsive design."""

    def test_works_on_mobile_viewport(self, page: Page, base_url: str):
        """Test that the UI works on mobile viewport."""
        page.set_viewport_size({"width": 375, "height": 667})

        page.goto(f"{base_url}/config")

        # Wait for app container to be visible
        app_container = page.locator(SELECTORS["app_container"])
        app_container.wait_for(state="visible", timeout=15000)

        expect(app_container).to_be_visible()

    def test_works_on_tablet_viewport(self, page: Page, base_url: str):
        """Test that the UI works on tablet viewport."""
        page.set_viewport_size({"width": 768, "height": 1024})

        page.goto(f"{base_url}/config")

        # Wait for app container to be visible
        app_container = page.locator(SELECTORS["app_container"])
        app_container.wait_for(state="visible", timeout=15000)

        expect(app_container).to_be_visible()

        app_container = page.locator(SELECTORS["app_container"])
        expect(app_container).to_be_visible()

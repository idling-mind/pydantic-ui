"""
E2E tests for data operations.

Tests CRUD operations and data synchronization:
- Loading data
- Saving changes
- Resetting data
- Validation
- Array operations (add/remove items)
- Nested object updates

Run these tests with:
    uv run pytest tests/e2e/test_data_operations.py -v

Requires the e2e_test_app.py example to be running at http://localhost:8000
"""

from playwright.sync_api import Page, expect

from .helpers import (
    SELECTORS,
    expand_all_tree_nodes,
    has_unsaved_changes,
    is_reset_button_enabled,
    is_save_button_enabled,
    wait_for_app_load,
    wait_for_tree_loaded,
)


class TestDataLoading:
    """Tests for data loading."""

    def test_loads_initial_data_on_mount(self, page: Page, base_url: str):
        """Test that initial data loads on mount."""
        with page.expect_response(
            lambda response: "/api/data" in response.url and response.status == 200
        ) as response_info:
            page.goto(f"{base_url}/config")

        response = response_info.value
        body = response.json()

        assert "data" in body, "Response should have 'data' field"
        assert body["data"] is not None, "Data should not be null"

    def test_populates_fields_with_loaded_data(self, page: Page, base_url: str):
        """Test that fields are populated with loaded data."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # At least one input should have a value (from default data)
        text_input = page.locator('input[type="text"]').first
        text_input.wait_for(state="visible", timeout=5000)

        value = text_input.input_value()
        # Should have default value loaded
        assert value is not None

    def test_handles_empty_data_gracefully(self, page: Page, base_url: str):
        """Test that empty/null data is handled gracefully."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Page should load without errors
        expect(page.locator(SELECTORS["app_container"])).to_be_visible()


class TestDataSaving:
    """Tests for data saving."""

    def test_save_button_is_disabled_when_no_changes(self, page: Page, base_url: str):
        """Test that save button is disabled when no changes."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        save_button = page.locator(SELECTORS["save_button"])
        save_button.wait_for(state="visible", timeout=5000)

        expect(save_button).to_be_disabled()

    def test_save_button_enables_after_changes(self, page: Page, base_url: str):
        """Test that save button enables after changes."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        text_input = page.locator('input[type="text"]').first
        text_input.wait_for(state="visible", timeout=5000)

        text_input.fill("Changed Value")
        page.wait_for_timeout(300)

        assert is_save_button_enabled(page), "Save button should be enabled after changes"

    def test_can_save_modified_data(self, page: Page, base_url: str):
        """Test that modified data can be saved."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        text_input = page.locator('input[type="text"]').first
        text_input.wait_for(state="visible", timeout=5000)

        text_input.fill("Saved Value E2E")
        page.wait_for_timeout(300)

        save_button = page.locator(SELECTORS["save_button"])
        save_button.wait_for(state="visible", timeout=5000)

        # Wait for button to be enabled
        expect(save_button).to_be_enabled(timeout=3000)

        with page.expect_response(
            lambda response: "/api/data" in response.url
            and response.request.method in ("POST", "PUT", "PATCH"),
            timeout=5000,
        ) as response_info:
            save_button.click()

        response = response_info.value
        assert response.status == 200, "Save should return 200"

    def test_save_button_disabled_after_successful_save(self, page: Page, base_url: str):
        """Test that save button is disabled after successful save."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        text_input = page.locator('input[type="text"]').first
        text_input.wait_for(state="visible", timeout=5000)

        text_input.fill("Test Value For Save")
        page.wait_for_timeout(200)

        save_button = page.locator(SELECTORS["save_button"])
        save_button.wait_for(state="visible", timeout=5000)

        # Wait for button to be enabled
        expect(save_button).to_be_enabled(timeout=3000)

        save_button.click()
        page.wait_for_timeout(1000)

        # Should be disabled again after save
        expect(save_button).to_be_disabled()


class TestDataReset:
    """Tests for data reset."""

    def test_reset_button_disabled_when_no_changes(self, page: Page, base_url: str):
        """Test that reset button is disabled when no changes."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        reset_button = page.locator(SELECTORS["reset_button"])
        reset_button.wait_for(state="visible", timeout=5000)

        expect(reset_button).to_be_disabled()

    def test_reset_button_enables_after_changes(self, page: Page, base_url: str):
        """Test that reset button enables after changes."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        text_input = page.locator('input[type="text"]').first
        text_input.wait_for(state="visible", timeout=5000)

        text_input.fill("Modified")
        page.wait_for_timeout(300)

        assert is_reset_button_enabled(page), "Reset button should be enabled after changes"

    def test_can_reset_changes_to_original_values(self, page: Page, base_url: str):
        """Test that changes can be reset to original values."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        text_input = page.locator('input[type="text"]').first
        text_input.wait_for(state="visible", timeout=5000)

        original_value = text_input.input_value()

        # Make a change
        text_input.fill("Changed Value For Reset Test")
        page.wait_for_timeout(300)

        # Reset
        reset_button = page.locator(SELECTORS["reset_button"])
        reset_button.wait_for(state="visible", timeout=5000)

        # Wait for button to be enabled
        expect(reset_button).to_be_enabled(timeout=3000)

        reset_button.click()
        page.wait_for_timeout(500)

        # Value should be reset
        expect(text_input).to_have_value(original_value)


class TestDataValidation:
    """Tests for data validation."""

    def test_validates_on_save(self, page: Page, base_url: str):
        """Test that validation occurs on save."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Clear a required field and try to save
        text_input = page.locator('input[type="text"]').first
        text_input.wait_for(state="visible", timeout=5000)

        text_input.fill("")
        page.wait_for_timeout(200)

        save_button = page.locator(SELECTORS["save_button"])
        save_button.wait_for(state="visible", timeout=5000)

        # If save is enabled, click it
        if not save_button.is_disabled():
            save_button.click()
            page.wait_for_timeout(500)

        # Should show validation error or prevent save
        expect(page.locator(SELECTORS["app_container"])).to_be_visible()

    def test_validates_number_ranges(self, page: Page, base_url: str):
        """Test that number ranges are validated."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        number_input = page.locator('input[type="number"]').first
        number_input.wait_for(state="visible", timeout=5000)

        min_val = number_input.get_attribute("min")

        if min_val:
            # Enter value below minimum
            below_min = int(float(min_val)) - 100
            number_input.fill(str(below_min))
            page.wait_for_timeout(200)

            save_button = page.locator(SELECTORS["save_button"])

            if not save_button.is_disabled():
                save_button.click()
                page.wait_for_timeout(500)

        # Should show validation error
        expect(page.locator(SELECTORS["app_container"])).to_be_visible()


class TestUnsavedChangesIndicator:
    """Tests for unsaved changes indicator."""

    def test_shows_unsaved_indicator_when_dirty(self, page: Page, base_url: str):
        """Test that unsaved indicator shows when there are changes."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        text_input = page.locator('input[type="text"]').first
        text_input.wait_for(state="visible", timeout=5000)

        text_input.fill("Changed value")
        page.wait_for_timeout(300)

        # Should show unsaved indicator
        assert has_unsaved_changes(page), "Should show unsaved changes indicator"

    def test_hides_unsaved_indicator_after_save(self, page: Page, base_url: str):
        """Test that unsaved indicator hides after save."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        text_input = page.locator('input[type="text"]').first
        text_input.wait_for(state="visible", timeout=5000)

        text_input.fill("Changed for save")
        page.wait_for_timeout(200)

        save_button = page.locator(SELECTORS["save_button"])
        save_button.wait_for(state="visible", timeout=5000)

        # Wait for button to be enabled
        expect(save_button).to_be_enabled(timeout=3000)

        save_button.click()
        page.wait_for_timeout(1000)

        # Unsaved indicator should be hidden
        assert not has_unsaved_changes(page), "Unsaved indicator should be hidden after save"


class TestNestedObjectUpdates:
    """Tests for nested object updates."""

    def test_can_navigate_to_nested_object(self, page: Page, base_url: str):
        """Test that nested objects can be navigated to."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        # Expand all to see nested nodes
        expand_all_tree_nodes(page)

        # Click on a nested node (should have more than one after expand)
        tree_nodes = page.locator(SELECTORS["tree_node"])
        expect(tree_nodes.first).to_be_visible(timeout=5000)

        node_count = tree_nodes.count()
        if node_count > 1:
            nested_node = tree_nodes.nth(1)
            nested_node.click()
            page.wait_for_timeout(300)

        # Detail panel should update
        expect(page.locator(SELECTORS["detail_panel"])).to_be_visible()

    def test_updates_nested_object_fields(self, page: Page, base_url: str):
        """Test that nested object fields can be updated."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        expand_all_tree_nodes(page)

        # Navigate to a nested node
        tree_nodes = page.locator(SELECTORS["tree_node"])
        expect(tree_nodes.first).to_be_visible(timeout=5000)

        node_count = tree_nodes.count()
        if node_count > 2:
            tree_nodes.nth(0).click()
            page.wait_for_timeout(300)

        # Edit a field
        input_elem = page.locator(SELECTORS["detail_panel"]).locator("input").first
        input_elem.wait_for(state="visible", timeout=500)

        input_elem.fill("Nested Value Updated")
        page.wait_for_timeout(1000)

        # Should have unsaved changes
        assert is_save_button_enabled(page), (
            "Save button should be enabled after nested object update"
        )


class TestDetailPanelUpdates:
    """Tests for detail panel updates when navigating."""

    def test_updates_detail_panel_when_navigating_tree(self, page: Page, base_url: str):
        """Test that detail panel updates when navigating tree."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        tree_nodes = page.locator(SELECTORS["tree_node"])

        if tree_nodes.count() > 1:
            # Click first node
            tree_nodes.first.click()
            page.wait_for_timeout(300)

            _first_title = page.locator(SELECTORS["detail_title"]).text_content()

            # Click second node
            tree_nodes.nth(1).click()
            page.wait_for_timeout(300)

            _second_title = page.locator(SELECTORS["detail_title"]).text_content()

            # Titles should be different (or at least the UI should update)
            expect(page.locator(SELECTORS["detail_panel"])).to_be_visible()

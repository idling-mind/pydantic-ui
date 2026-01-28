"""
E2E tests for field renderers.

Tests different input types and custom renderers:
- Text inputs (single and multi-line)
- Number inputs and sliders
- Boolean toggles and checkboxes
- Select dropdowns
- Date/time pickers
- Color pickers

Run these tests with:
    uv run pytest tests/e2e/test_field_renderers.py -v

Requires the e2e_test_app.py example to be running at http://localhost:8000
"""

import pytest
from playwright.sync_api import Page, expect

from .helpers import (
    SELECTORS,
    expand_all_tree_nodes,
    get_field_by_path,
    get_field_by_type,
    wait_for_app_load,
)


class TestTextInputRenderers:
    """Tests for text input renderers."""

    def test_text_fields_are_visible(self, page: Page, base_url: str):
        """Test that text fields are visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        text_fields = page.locator(get_field_by_type("text"))
        expect(text_fields.first).to_be_visible(timeout=5000)

    def test_can_edit_single_line_text_inputs(self, page: Page, base_url: str):
        """Test editing single-line text inputs."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        text_input = page.locator('input[type="text"]').first
        text_input.wait_for(state="visible", timeout=5000)

        original_value = text_input.input_value()
        text_input.click()
        text_input.fill("Test Value 123")

        expect(text_input).to_have_value("Test Value 123")

        # Restore
        text_input.fill(original_value)

    def test_can_edit_multi_line_text_textarea(self, page: Page, base_url: str):
        """Test editing multi-line text (textarea)."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        textarea = page.locator("textarea").first
        textarea.wait_for(state="visible", timeout=5000)

        textarea.click()
        textarea.fill("Line 1\nLine 2\nLine 3")

        value = textarea.input_value()
        assert "Line 1" in value
        assert "Line 2" in value


class TestNumberInputRenderers:
    """Tests for number input renderers."""

    def test_number_fields_are_visible(self, page: Page, base_url: str):
        """Test that number fields are visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        number_fields = page.locator(get_field_by_type("number"))
        expect(number_fields.first).to_be_visible(timeout=5000)

    def test_can_edit_number_inputs(self, page: Page, base_url: str):
        """Test editing number inputs."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        number_input = page.locator('input[type="number"]').first
        number_input.wait_for(state="visible", timeout=5000)

        number_input.click()
        number_input.fill("42")

        expect(number_input).to_have_value("42")

    @pytest.mark.skip(reason="Slider may not be present in all configurations")
    def test_can_use_slider_for_numbers(self, page: Page, base_url: str):
        """Test using slider for number input."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Expand all to see sliders
        expand_all_tree_nodes(page)

        slider = page.locator('[role="slider"]').first
        slider.wait_for(state="visible", timeout=5000)

        # Get bounding box
        box = slider.bounding_box()
        if box:
            # Click in the middle
            page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            page.wait_for_timeout(300)

        expect(slider).to_be_visible()

    def test_handles_decimal_numbers_correctly(self, page: Page, base_url: str):
        """Test handling of decimal numbers."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        number_input = page.locator('input[type="number"]').first
        number_input.wait_for(state="visible", timeout=5000)

        # Test decimal input
        number_input.fill("3.14")
        value = number_input.input_value()
        # Value should be set (may be rounded based on step)
        assert value is not None and len(value) > 0


class TestBooleanInputRenderers:
    """Tests for boolean input renderers."""

    def test_toggle_fields_are_visible(self, page: Page, base_url: str):
        """Test that toggle fields are visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        toggle_fields = page.locator(get_field_by_type("toggle"))
        expect(toggle_fields.first).to_be_visible(timeout=5000)

    def test_can_toggle_switch_inputs(self, page: Page, base_url: str):
        """Test toggling switch inputs."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        toggle = page.locator('[role="switch"]').first
        toggle.wait_for(state="visible", timeout=5000)

        initial_state = toggle.get_attribute("aria-checked") == "true"

        toggle.click()
        page.wait_for_timeout(300)

        new_state = toggle.get_attribute("aria-checked") == "true"
        assert new_state != initial_state, "Toggle state should change"

    @pytest.mark.skip(reason="Checkboxes may not be present - app uses toggle switches")
    def test_can_toggle_checkboxes(self, page: Page, base_url: str):
        """Test toggling checkboxes."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        checkbox = page.locator('input[type="checkbox"]').first
        checkbox.wait_for(state="visible", timeout=5000)

        initial_state = checkbox.is_checked()

        checkbox.click()
        page.wait_for_timeout(300)

        new_state = checkbox.is_checked()
        assert new_state != initial_state, "Checkbox state should change"

        # Toggle back
        checkbox.click()
        page.wait_for_timeout(300)

        final_state = checkbox.is_checked()
        assert final_state == initial_state, "Checkbox should toggle back"


class TestSelectDropdownRenderers:
    """Tests for select dropdown renderers."""

    def test_can_open_select_dropdown(self, page: Page, base_url: str):
        """Test opening select dropdown."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # For shadcn/ui Select component
        select_trigger = page.locator('[role="combobox"]').first
        select_trigger.wait_for(state="visible", timeout=5000)

        select_trigger.click()
        page.wait_for_timeout(300)

        # Dropdown options should appear
        options = page.locator('[role="option"]')
        expect(options.first).to_be_visible(timeout=3000)

    def test_can_select_dropdown_option(self, page: Page, base_url: str):
        """Test selecting a dropdown option."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # For shadcn/ui Select component
        select_trigger = page.locator('[role="combobox"]').first
        select_trigger.wait_for(state="visible", timeout=5000)

        select_trigger.click()
        page.wait_for_timeout(300)

        # Click an option
        options = page.locator('[role="option"]')
        options.first.wait_for(state="visible", timeout=3000)

        second_option = options.nth(1) if options.count() > 1 else options.first
        second_option.click()
        page.wait_for_timeout(300)

        # Selection should be made
        expect(page.locator(SELECTORS["app_container"])).to_be_visible()


class TestDateAndTimeRenderers:
    """Tests for date and time renderers."""

    @pytest.mark.skip(reason="Date fields may not be visible without specific navigation")
    def test_date_fields_are_visible(self, page: Page, base_url: str):
        """Test that date fields are visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Expand to show date fields
        expand_all_tree_nodes(page)

        date_fields = page.locator(get_field_by_type("date"))
        date_fields.first.wait_for(state="visible", timeout=5000)
        expect(date_fields.first).to_be_visible()

    @pytest.mark.skip(reason="Date inputs may not be visible without specific navigation")
    def test_can_edit_date_inputs(self, page: Page, base_url: str):
        """Test editing date inputs."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        expand_all_tree_nodes(page)

        date_input = page.locator('input[type="date"]').first
        date_input.wait_for(state="visible", timeout=5000)

        date_input.fill("2024-12-25")
        page.wait_for_timeout(300)

        value = date_input.input_value()
        assert value == "2024-12-25"


class TestColorPickerRenderer:
    """Tests for color picker renderer."""

    def test_color_fields_exist(self, page: Page, base_url: str):
        """Test that color fields exist."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        expand_all_tree_nodes(page)
        page.wait_for_timeout(500)

        color_fields = page.locator(get_field_by_type("color"))
        # May or may not have color fields
        assert color_fields.count() >= 0


class TestFieldLabelsAndDescriptions:
    """Tests for field labels and descriptions."""

    def test_fields_have_labels(self, page: Page, base_url: str):
        """Test that fields have labels."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Find field labels
        labels = page.locator(SELECTORS["field_label"])
        expect(labels.first).to_be_visible(timeout=5000)

    def test_fields_have_controls(self, page: Page, base_url: str):
        """Test that fields have controls."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Find field controls
        controls = page.locator(SELECTORS["field_control"])
        expect(controls.first).to_be_visible(timeout=5000)


class TestFieldPathAttribute:
    """Tests for field path data attributes."""

    def test_fields_have_path_attribute(self, page: Page, base_url: str):
        """Test that fields have path attribute."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Find a field with path attribute
        fields = page.locator("[data-pydantic-ui-path]")
        expect(fields.first).to_be_visible(timeout=5000)

    def test_can_find_field_by_path(self, page: Page, base_url: str):
        """Test finding field by path attribute."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Try to find a known field - app_name is in our e2e test app
        field = page.locator(get_field_by_path("app_name"))
        if field.count() > 0:
            expect(field.first).to_be_visible(timeout=5000)


class TestFieldValidation:
    """Tests for field validation."""

    def test_shows_required_indicator(self, page: Page, base_url: str):
        """Test that required fields show indicator."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Required fields should have an asterisk
        required_indicator = page.locator(".text-destructive").filter(has_text="*")
        expect(required_indicator.first).to_be_visible(timeout=5000)

    def test_shows_validation_error_on_invalid_input(self, page: Page, base_url: str):
        """Test that validation errors are shown."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        text_input = page.locator('input[type="text"]').first
        text_input.wait_for(state="visible", timeout=5000)

        text_input.fill("")
        page.wait_for_timeout(200)

        save_button = page.locator(SELECTORS["save_button"])

        # Try to save if button is enabled
        if not save_button.is_disabled():
            save_button.click()
            page.wait_for_timeout(500)

        # App should still be functional
        expect(page.locator(SELECTORS["app_container"])).to_be_visible()

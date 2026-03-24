"""E2E tests for generic Annotated union labels and DisplayConfig title overrides."""

import re

import pytest
from playwright.sync_api import Page, expect

from .helpers import get_data_from_api, save_data, wait_for_app_load

pytestmark = pytest.mark.e2e


class TestAnnotatedUnionLabels:
    """Tests for union label rendering with alias-backed annotated variants."""

    def test_annotated_union_variants_are_distinct_and_field_title_is_overridden(
        self, page: Page, base_url: str
    ):
        """The union field should honor DisplayConfig title and render distinct alias labels."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Open root object editor where the union field cards are shown.
        page.locator('[data-tree-path=""]').first.click()

        union_field = page.locator(
            '[data-pydantic-ui-field-type="union"][data-pydantic-ui-path="server_timeout"]'
        ).first
        expect(union_field).to_be_visible(timeout=5000)

        expect(union_field.locator('[data-pydantic-ui="field-label"]').first).to_contain_text(
            "Server Timeout Policy"
        )

        expect(
            union_field.get_by_role(
                "heading",
                name=re.compile(r"^(PositiveInt|Server Timeout \(Enabled\))$", re.I),
            ).first
        ).to_be_visible()
        expect(
            union_field.get_by_role("heading", name=re.compile(r"^NegativeInt$", re.I)).first
        ).to_be_visible()

    def test_switching_annotated_union_variant_persists_value(self, page: Page, base_url: str):
        """Selecting the <0 variant should persist a negative timeout value."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        page.locator('[data-tree-path=""]').first.click()

        union_field = page.locator(
            '[data-pydantic-ui-field-type="union"][data-pydantic-ui-path="server_timeout"]'
        ).first
        expect(union_field).to_be_visible(timeout=5000)

        union_field.get_by_role("heading", name=re.compile(r"^NegativeInt$", re.I)).first.click()

        confirm_dialog = page.locator('[role="alertdialog"]').filter(has_text="Change Type?").first
        expect(confirm_dialog).to_be_visible(timeout=5000)
        confirm_dialog.get_by_role("button", name="Change Type").click()

        number_input = union_field.locator('input[type="number"]').first
        expect(number_input).to_be_visible(timeout=5000)
        number_input.fill("-7")

        save_response = save_data(page)
        assert save_response is not None, "Expected save response after union variant switch"
        assert save_response.status == 200

        api_data = get_data_from_api(page, base_url)
        assert api_data["data"]["server_timeout"] == -7

    def test_switching_between_negative_and_positive_timeout_variants(
        self, page: Page, base_url: str
    ):
        """Switching timeout union branches should persist the active branch value after save."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        page.locator('[data-tree-path=""]').first.click()

        union_field = page.locator(
            '[data-pydantic-ui-field-type="union"][data-pydantic-ui-path="server_timeout"]'
        ).first
        expect(union_field).to_be_visible(timeout=5000)

        union_field.get_by_role("heading", name=re.compile(r"^NegativeInt$", re.I)).first.click()
        confirm_dialog = page.locator('[role="alertdialog"]').filter(has_text="Change Type?").first
        expect(confirm_dialog).to_be_visible(timeout=5000)
        confirm_dialog.get_by_role("button", name="Change Type").click()

        negative_input = union_field.locator('input[type="number"]').first
        expect(negative_input).to_be_visible(timeout=5000)
        negative_input.fill("-3")

        union_field.get_by_role(
            "heading",
            name=re.compile(r"^(PositiveInt|Server Timeout \(Enabled\))$", re.I),
        ).first.click()
        expect(confirm_dialog).to_be_visible(timeout=5000)
        confirm_dialog.get_by_role("button", name="Change Type").click()

        positive_input = union_field.locator('input[type="number"]').first
        expect(positive_input).to_be_visible(timeout=5000)
        positive_input.fill("45")

        save_response = save_data(page)
        assert save_response is not None, "Expected save response after switching union branches"
        assert save_response.status == 200

        api_data = get_data_from_api(page, base_url)
        assert api_data["data"]["server_timeout"] == 45

    def test_alias_backed_retry_budget_union_uses_alias_labels(self, page: Page, base_url: str):
        """Alias-backed Annotated union variants should render with alias labels."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        page.locator('[data-tree-path=""]').first.click()

        union_field = page.locator(
            '[data-pydantic-ui-field-type="union"][data-pydantic-ui-path="retry_budget"]'
        ).first
        expect(union_field).to_be_visible(timeout=5000)

        expect(union_field.locator('[data-pydantic-ui="field-label"]').first).to_contain_text(
            "Retry Budget Profile"
        )
        expect(
            union_field.get_by_role(
                "heading", name=re.compile(r"^AggressiveRetryBudget$", re.I)
            ).first
        ).to_be_visible()
        expect(
            union_field.get_by_role(
                "heading", name=re.compile(r"^ConservativeRetryBudget$", re.I)
            ).first
        ).to_be_visible()

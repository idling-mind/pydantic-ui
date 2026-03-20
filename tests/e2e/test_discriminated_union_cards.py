"""E2E tests for discriminated union cards in the detail panel."""

import re

import pytest
from playwright.sync_api import Page, expect

from .helpers import get_data_from_api, save_data, wait_for_app_load

pytestmark = pytest.mark.e2e


def open_storage_backend(page: Page, base_url: str):
    """Open the root editor and return the storage_backend union field locator."""
    page.goto(f"{base_url}/config")
    wait_for_app_load(page)

    # The union card selector is rendered inside the root object editor.
    # Selecting the tree node for "storage_backend" navigates directly to the
    # active variant editor, which intentionally does not render union cards.
    page.locator('[data-tree-path=""]').first.click()

    union_field = page.locator(
        '[data-pydantic-ui-field-type="union"][data-pydantic-ui-path="storage_backend"]'
    ).first
    expect(union_field).to_be_visible(timeout=5000)
    return union_field


class TestDiscriminatedUnionCards:
    """Tests for discriminated unions rendered as selectable cards."""

    def test_renders_union_cards_for_storage_backend(self, page: Page, base_url: str):
        """The storage backend union should render all variants as card options."""
        union_field = open_storage_backend(page, base_url)

        # Current card headings use discriminator values for discriminated unions.
        expect(
            union_field.get_by_role("heading", name=re.compile(r"^disk$", re.I)).first
        ).to_be_visible()
        expect(
            union_field.get_by_role("heading", name=re.compile(r"^s3$", re.I)).first
        ).to_be_visible()
        expect(
            union_field.get_by_role("heading", name=re.compile(r"^memory$", re.I)).first
        ).to_be_visible()

        # Card subtitle overrides from class_configs should still be visible.
        expect(union_field.get_by_text("Local filesystem backend").first).to_be_visible()
        expect(union_field.get_by_text("Object storage backend").first).to_be_visible()
        expect(union_field.get_by_text("Ephemeral in-memory backend").first).to_be_visible()

        selected_badges = union_field.locator("text=Selected")
        assert selected_badges.count() == 1, "Expected exactly one selected union card"

        api_data = get_data_from_api(page, base_url)
        backend = api_data["data"]["storage_backend"]
        assert backend["backend_type"] == "disk"

    def test_switching_union_card_with_confirmation_persists(self, page: Page, base_url: str):
        """Switching card variants should show confirmation and persist selected variant."""
        union_field = open_storage_backend(page, base_url)

        union_field.get_by_role("heading", name=re.compile(r"^s3$", re.I)).first.click()

        confirm_dialog = page.locator('[role="alertdialog"]').filter(has_text="Change Type?").first
        expect(confirm_dialog).to_be_visible(timeout=5000)
        confirm_dialog.get_by_role("button", name="Change Type").click()

        bucket_input = page.locator('[data-pydantic-ui-path="storage_backend.bucket"] input').first
        expect(bucket_input).to_be_visible(timeout=5000)
        expect(bucket_input).to_have_value("e2e-config-bucket")

        save_response = save_data(page)
        assert save_response is not None, "Expected save response after union variant switch"
        assert save_response.status == 200

        api_data = get_data_from_api(page, base_url)
        backend = api_data["data"]["storage_backend"]
        assert backend["backend_type"] == "s3"
        assert backend["bucket"] == "e2e-config-bucket"

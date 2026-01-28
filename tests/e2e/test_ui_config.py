"""E2E tests for UI configuration and theming.

Tests UI customization features:
- Theme switching (light/dark/system)
- Custom titles and descriptions
- Action buttons
- UI layout
- Responsive design

Run these tests with:
    uv run pytest tests/e2e/test_ui_config.py -v

Requires the e2e_test_app.py example to be running at http://localhost:8000
"""

import re

import pytest
from playwright.sync_api import Page, expect

from .helpers import (
    SELECTORS,
    is_dark_mode,
    switch_theme,
    wait_for_app_load,
)

pytestmark = pytest.mark.e2e


class TestThemeSwitching:
    """Tests for theme switching."""

    def test_theme_toggle_is_visible(self, page: Page, base_url: str):
        """Test that theme toggle is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        theme_toggle = page.locator(SELECTORS["theme_toggle"])
        expect(theme_toggle).to_be_visible()

    def test_can_open_theme_menu(self, page: Page, base_url: str):
        """Test that theme menu can be opened."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        theme_toggle = page.locator(SELECTORS["theme_toggle"])
        theme_toggle.click()
        page.wait_for_timeout(300)

        # Menu items should appear
        menu_items = page.get_by_text(re.compile(r"light|dark|system", re.I))
        expect(menu_items.first).to_be_visible(timeout=3000)

    def test_can_switch_to_dark_theme(self, page: Page, base_url: str):
        """Test switching to dark theme."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        switch_theme(page, "dark")

        # HTML should have dark class
        assert is_dark_mode(page), "Should be in dark mode"

    def test_can_switch_to_light_theme(self, page: Page, base_url: str):
        """Test switching to light theme."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        switch_theme(page, "light")

        # Should not be in dark mode
        assert not is_dark_mode(page), "Should not be in dark mode"

    def test_theme_persists_across_page_reloads(self, page: Page, base_url: str):
        """Test that theme persists across page reloads."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Set dark theme
        switch_theme(page, "dark")
        assert is_dark_mode(page)

        # Reload page
        page.reload()
        wait_for_app_load(page)

        # Theme should still be dark
        assert is_dark_mode(page), "Theme should persist after reload"

    def test_theme_affects_component_styling(self, page: Page, base_url: str):
        """Test that theme affects component styling."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Get initial background color in light mode
        switch_theme(page, "light")
        body = page.locator("body")
        light_bg = body.evaluate("(el) => window.getComputedStyle(el).backgroundColor")

        # Switch to dark theme
        switch_theme(page, "dark")
        dark_bg = body.evaluate("(el) => window.getComputedStyle(el).backgroundColor")

        # Colors should differ
        assert light_bg != dark_bg, "Background should change with theme"


class TestThemeAwareLogos:
    """Tests for theme-aware logo switching."""

    def test_logo_image_is_visible(self, page: Page, base_url: str):
        """Test that logo image is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        logo_img = page.locator(SELECTORS["header_logo_img"])
        expect(logo_img).to_be_visible(timeout=10000)

    def test_logo_has_src_attribute(self, page: Page, base_url: str):
        """Test that logo image has a src attribute."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        logo_img = page.locator(SELECTORS["header_logo_img"])
        expect(logo_img).to_be_visible(timeout=10000)

        src = logo_img.get_attribute("src")
        assert src is not None and len(src) > 0, "Logo should have a src attribute"

    def test_logo_changes_on_theme_switch(self, page: Page, base_url: str):
        """Test that logo changes when theme is switched."""
        # Load config to check if theme-aware logos are configured
        with page.expect_response(
            lambda response: "/api/config" in response.url and response.status == 200
        ) as response_info:
            page.goto(f"{base_url}/config")

        response = response_info.value
        config = response.json()

        wait_for_app_load(page)

        # Only run this test if both logo_url and logo_url_dark are configured
        logo_url = config.get("logo_url")
        logo_url_dark = config.get("logo_url_dark")

        if not logo_url or not logo_url_dark:
            # Skip if theme-aware logos are not configured
            return

        # Switch to light theme and get logo src
        switch_theme(page, "light")
        page.wait_for_timeout(500)  # Allow logo to update

        logo_img = page.locator(SELECTORS["header_logo_img"])
        expect(logo_img).to_be_visible(timeout=10000)
        light_logo_src = logo_img.get_attribute("src")

        # Switch to dark theme and get logo src
        switch_theme(page, "dark")
        page.wait_for_timeout(500)  # Allow logo to update

        logo_img = page.locator(SELECTORS["header_logo_img"])
        expect(logo_img).to_be_visible(timeout=10000)
        dark_logo_src = logo_img.get_attribute("src")

        # Verify logos are different
        assert light_logo_src != dark_logo_src, (
            f"Logo should change between themes. Light: {light_logo_src}, Dark: {dark_logo_src}"
        )

    def test_light_theme_uses_logo_url(self, page: Page, base_url: str):
        """Test that light theme uses logo_url."""
        # Load config
        with page.expect_response(
            lambda response: "/api/config" in response.url and response.status == 200
        ) as response_info:
            page.goto(f"{base_url}/config")

        response = response_info.value
        config = response.json()

        wait_for_app_load(page)

        logo_url = config.get("logo_url")
        if not logo_url:
            return  # Skip if no logo_url configured

        # Switch to light theme
        switch_theme(page, "light")
        page.wait_for_timeout(500)

        logo_img = page.locator(SELECTORS["header_logo_img"])
        expect(logo_img).to_be_visible(timeout=10000)
        src = logo_img.get_attribute("src")

        assert src == logo_url, f"Light theme should use logo_url. Expected: {logo_url}, Got: {src}"

    def test_dark_theme_uses_logo_url_dark(self, page: Page, base_url: str):
        """Test that dark theme uses logo_url_dark."""
        # Load config
        with page.expect_response(
            lambda response: "/api/config" in response.url and response.status == 200
        ) as response_info:
            page.goto(f"{base_url}/config")

        response = response_info.value
        config = response.json()

        wait_for_app_load(page)

        logo_url_dark = config.get("logo_url_dark")
        if not logo_url_dark:
            return  # Skip if no logo_url_dark configured

        # Switch to dark theme
        switch_theme(page, "dark")
        page.wait_for_timeout(500)

        logo_img = page.locator(SELECTORS["header_logo_img"])
        expect(logo_img).to_be_visible(timeout=10000)
        src = logo_img.get_attribute("src")

        assert src == logo_url_dark, (
            f"Dark theme should use logo_url_dark. Expected: {logo_url_dark}, Got: {src}"
        )

    def test_dark_theme_falls_back_to_logo_url_if_no_dark_logo(self, page: Page, base_url: str):
        """Test that dark theme falls back to logo_url if logo_url_dark is not set."""
        # Load config
        with page.expect_response(
            lambda response: "/api/config" in response.url and response.status == 200
        ) as response_info:
            page.goto(f"{base_url}/config")

        response = response_info.value
        config = response.json()

        wait_for_app_load(page)

        logo_url = config.get("logo_url")
        logo_url_dark = config.get("logo_url_dark")

        # This test only applies when logo_url is set but logo_url_dark is not
        if logo_url_dark or not logo_url:
            return

        # Switch to dark theme
        switch_theme(page, "dark")
        page.wait_for_timeout(500)

        logo_img = page.locator(SELECTORS["header_logo_img"])
        expect(logo_img).to_be_visible(timeout=10000)
        src = logo_img.get_attribute("src")

        # Should fall back to logo_url
        assert src == logo_url, f"Should fall back to logo_url. Expected: {logo_url}, Got: {src}"


class TestUIConfiguration:
    """Tests for UI configuration."""

    def test_displays_title_from_config(self, page: Page, base_url: str):
        """Test that title from config is displayed."""
        with page.expect_response(
            lambda response: "/api/config" in response.url and response.status == 200
        ) as response_info:
            page.goto(f"{base_url}/config")

        response = response_info.value
        config = response.json()

        wait_for_app_load(page)

        if config.get("title"):
            header_title = page.locator(SELECTORS["header_title"])
            expect(header_title).to_contain_text(config["title"])

    def test_header_is_visible(self, page: Page, base_url: str):
        """Test that header is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        header = page.locator(SELECTORS["header"])
        expect(header).to_be_visible()

    def test_detail_footer_is_visible(self, page: Page, base_url: str):
        """Test that detail footer is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        footer = page.locator(SELECTORS["detail_footer"])
        expect(footer).to_be_visible()


class TestActionButtons:
    """Tests for action buttons."""

    def test_action_buttons_visible_if_configured(self, page: Page, base_url: str):
        """Test that action buttons are visible if configured."""
        with page.expect_response(
            lambda response: "/api/config" in response.url and response.status == 200
        ) as response_info:
            page.goto(f"{base_url}/config")

        response = response_info.value
        config = response.json()

        wait_for_app_load(page)

        if config.get("actions") and len(config["actions"]) > 0:
            # Action buttons should be in the footer area
            for action in config["actions"]:
                button = page.get_by_role("button", name=re.compile(action["label"], re.I))
                if button.count() > 0:
                    expect(button.first).to_be_visible()

    def test_action_button_is_clickable(self, page: Page, base_url: str):
        """Test that action buttons are clickable."""
        with page.expect_response(
            lambda response: "/api/config" in response.url and response.status == 200
        ) as response_info:
            page.goto(f"{base_url}/config")

        response = response_info.value
        config = response.json()

        wait_for_app_load(page)

        if config.get("actions") and len(config["actions"]) > 0:
            first_action = config["actions"][0]
            button = page.get_by_role("button", name=re.compile(first_action["label"], re.I))

            if button.count() > 0 and button.first.is_visible():
                # Button should be enabled
                assert not button.first.is_disabled(), "Action button should be enabled"


class TestLayoutAndResponsiveness:
    """Tests for layout and responsiveness."""

    def test_desktop_layout_shows_panels_side_by_side(self, page: Page, base_url: str):
        """Test that desktop layout shows panels side-by-side."""
        page.set_viewport_size({"width": 1280, "height": 720})
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Both panels should be visible
        tree_panel = page.locator(SELECTORS["tree_panel"])
        detail_panel = page.locator(SELECTORS["detail_panel"])

        expect(tree_panel).to_be_visible()
        expect(detail_panel).to_be_visible()

    def test_mobile_layout_works(self, page: Page, base_url: str):
        """Test that mobile layout works."""
        page.set_viewport_size({"width": 375, "height": 667})
        page.goto(f"{base_url}/config")

        # Wait for app container to be visible
        app_container = page.locator(SELECTORS["app_container"])
        app_container.wait_for(state="visible", timeout=15000)

        expect(app_container).to_be_visible()

    def test_tablet_layout_works(self, page: Page, base_url: str):
        """Test that tablet layout works."""
        page.set_viewport_size({"width": 768, "height": 1024})
        page.goto(f"{base_url}/config")

        # Wait for app container to be visible
        app_container = page.locator(SELECTORS["app_container"])
        app_container.wait_for(state="visible", timeout=15000)

        expect(app_container).to_be_visible()

    def test_handles_window_resize(self, page: Page, base_url: str):
        """Test that window resize is handled."""
        page.set_viewport_size({"width": 1280, "height": 720})
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # Resize to mobile
        page.set_viewport_size({"width": 375, "height": 667})
        page.wait_for_timeout(500)

        # Should still work
        expect(page.locator(SELECTORS["app_container"])).to_be_visible()

        # Resize back to desktop
        page.set_viewport_size({"width": 1280, "height": 720})
        page.wait_for_timeout(500)

        expect(page.locator(SELECTORS["app_container"])).to_be_visible()


class TestHeaderComponents:
    """Tests for header components."""

    def test_header_logo_title_visible(self, page: Page, base_url: str):
        """Test that header logo title area is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        header_logo_title = page.locator(SELECTORS["header_logo_title"])
        expect(header_logo_title).to_be_visible()

    def test_header_title_visible(self, page: Page, base_url: str):
        """Test that header title is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        header_title = page.locator(SELECTORS["header_title"])
        expect(header_title).to_be_visible()


class TestLoadingStates:
    """Tests for loading states."""

    def test_app_loads_completely(self, page: Page, base_url: str):
        """Test that app loads completely."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        # All main components should be visible
        expect(page.locator(SELECTORS["app_container"])).to_be_visible()
        expect(page.locator(SELECTORS["header"])).to_be_visible()
        expect(page.locator(SELECTORS["tree_panel"])).to_be_visible()
        expect(page.locator(SELECTORS["detail_panel"])).to_be_visible()


class TestErrorStates:
    """Tests for error states."""

    def test_handles_invalid_path_gracefully(self, page: Page, base_url: str):
        """Test that invalid paths are handled gracefully."""
        page.goto(f"{base_url}/config/invalid-path-that-does-not-exist")
        page.wait_for_timeout(1000)

        # Should show error or redirect, but not crash
        expect(page.locator("body")).to_be_visible()

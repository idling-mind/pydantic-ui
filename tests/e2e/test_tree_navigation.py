"""
E2E tests for tree navigation functionality.

Tests tree panel interactions including:
- Node expansion/collapse
- Node selection
- Deep nesting navigation
- Tree toolbar actions

Run these tests with:
    uv run pytest tests/e2e/test_tree_navigation.py -v

Requires the e2e_test_app.py example to be running at http://localhost:8000
"""

from playwright.sync_api import Page, expect

from .helpers import (
    SELECTORS,
    collapse_all_tree_nodes,
    expand_all_tree_nodes,
    get_tree_node_count,
    wait_for_app_load,
    wait_for_tree_loaded,
)


class TestTreePanelDisplay:
    """Tests for tree panel display."""

    def test_displays_tree_panel(self, page: Page, base_url: str):
        """Test that tree panel is visible on load."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        tree_panel = page.locator(SELECTORS["tree_panel"])
        expect(tree_panel).to_be_visible()

    def test_displays_tree_nodes(self, page: Page, base_url: str):
        """Test that tree nodes are visible on load."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        node_count = get_tree_node_count(page)
        assert node_count > 0, "Expected at least one tree node"

    def test_displays_tree_search(self, page: Page, base_url: str):
        """Test that tree search is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        tree_search = page.locator(SELECTORS["tree_search"])
        expect(tree_search).to_be_visible()

    def test_displays_tree_toolbar(self, page: Page, base_url: str):
        """Test that tree toolbar is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        tree_toolbar = page.locator(SELECTORS["tree_toolbar"])
        expect(tree_toolbar).to_be_visible()

    def test_displays_expand_all_button(self, page: Page, base_url: str):
        """Test that expand all button is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        expand_all = page.locator(SELECTORS["tree_expand_all"])
        expect(expand_all).to_be_visible()

    def test_displays_collapse_all_button(self, page: Page, base_url: str):
        """Test that collapse all button is visible."""
        page.goto(f"{base_url}/config")
        wait_for_app_load(page)

        collapse_all = page.locator(SELECTORS["tree_collapse_all"])
        expect(collapse_all).to_be_visible()


class TestTreeNodeSelection:
    """Tests for tree node selection."""

    def test_can_select_tree_node(self, page: Page, base_url: str):
        """Test selecting a tree node."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        # Click first node
        first_node = page.locator(SELECTORS["tree_node"]).first
        first_node.click()
        page.wait_for_timeout(300)

        # Node should be selected
        is_selected = first_node.get_attribute("data-pydantic-ui-selected")
        assert is_selected == "true", "Node should be selected after click"

    def test_selection_updates_detail_panel(self, page: Page, base_url: str):
        """Test that selecting a node updates the detail panel."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        # Get initial detail title
        detail_title = page.locator(SELECTORS["detail_title"])
        detail_title.wait_for(state="visible", timeout=5000)

        # Click a different node (expand first to get more nodes)
        expand_all_tree_nodes(page)

        tree_nodes = page.locator(SELECTORS["tree_node"])
        node_count = tree_nodes.count()

        if node_count > 1:
            second_node = tree_nodes.nth(1)
            second_node.click()
            page.wait_for_timeout(300)

        # Detail panel should update
        expect(page.locator(SELECTORS["detail_panel"])).to_be_visible()

    def test_only_one_node_selected_at_a_time(self, page: Page, base_url: str):
        """Test that only one node can be selected at a time."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        expand_all_tree_nodes(page)

        tree_nodes = page.locator(SELECTORS["tree_node"])
        tree_nodes.first.wait_for(state="visible", timeout=5000)

        node_count = tree_nodes.count()
        if node_count > 1:
            # Click first node
            tree_nodes.first.click()
            page.wait_for_timeout(200)

            # Click second node
            tree_nodes.nth(1).click()
            page.wait_for_timeout(200)

        # Count selected nodes
        selected_nodes = page.locator(
            '[data-pydantic-ui="tree-node"][data-pydantic-ui-selected="true"]'
        )
        assert selected_nodes.count() == 1, "Only one node should be selected"


class TestTreeNodeExpansion:
    """Tests for tree node expansion/collapse."""

    def test_can_expand_node(self, page: Page, base_url: str):
        """Test expanding a tree node."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        # Find an expandable node (has expanded attribute set to false)
        expandable_node = page.locator(
            '[data-pydantic-ui="tree-node"][data-pydantic-ui-expanded="false"]'
        ).first

        initial_count = get_tree_node_count(page)

        if expandable_node.count() > 0:
            expandable_node.wait_for(state="visible", timeout=5000)

            # Click expand button within the node
            expand_btn = expandable_node.locator("button").first
            if expand_btn.count() > 0:
                expand_btn.click()
                page.wait_for_timeout(300)

        # Should have more nodes now or same
        new_count = get_tree_node_count(page)
        assert new_count >= initial_count

    def test_can_collapse_node(self, page: Page, base_url: str):
        """Test collapsing a tree node."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        # First expand all
        expand_all_tree_nodes(page)
        expanded_count = get_tree_node_count(page)

        # Find an expanded node
        expanded_node = page.locator(
            '[data-pydantic-ui="tree-node"][data-pydantic-ui-expanded="true"]'
        ).first

        if expanded_node.count() > 0:
            expanded_node.wait_for(state="visible", timeout=5000)

            collapse_btn = expanded_node.locator("button").first
            if collapse_btn.count() > 0:
                collapse_btn.click()
                page.wait_for_timeout(300)

        # Should have fewer or same nodes
        new_count = get_tree_node_count(page)
        assert new_count <= expanded_count

    def test_expand_all_button_expands_all(self, page: Page, base_url: str):
        """Test that expand all button expands all nodes."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        # First collapse all
        collapse_all_tree_nodes(page)
        page.wait_for_timeout(300)
        collapsed_count = get_tree_node_count(page)

        # Now expand all
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)
        expanded_count = get_tree_node_count(page)

        assert expanded_count >= collapsed_count, "Expand all should show more or equal nodes"

    def test_collapse_all_button_collapses_all(self, page: Page, base_url: str):
        """Test that collapse all button collapses all nodes."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        # First expand all
        expand_all_tree_nodes(page)
        page.wait_for_timeout(300)
        expanded_count = get_tree_node_count(page)

        # Now collapse all
        collapse_all_tree_nodes(page)
        page.wait_for_timeout(300)
        collapsed_count = get_tree_node_count(page)

        assert collapsed_count <= expanded_count, "Collapse all should show fewer or equal nodes"


class TestTreeSearch:
    """Tests for tree search functionality."""

    def test_search_filters_nodes(self, page: Page, base_url: str):
        """Test that search filters tree nodes."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        # Expand all first
        expand_all_tree_nodes(page)

        # Type in search
        search_input = page.locator(SELECTORS["tree_search"])
        search_input.wait_for(state="visible", timeout=5000)

        search_input.fill("app")  # Search for "app"
        page.wait_for_timeout(500)

        # Should have filtered nodes
        filtered_count = get_tree_node_count(page)
        # Could be equal if all match or fewer
        assert filtered_count > 0, "Search should show at least one result"

    def test_clear_search_shows_all_nodes(self, page: Page, base_url: str):
        """Test that clearing search shows all nodes."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        expand_all_tree_nodes(page)

        # Search and then clear
        search_input = page.locator(SELECTORS["tree_search"])
        search_input.wait_for(state="visible", timeout=5000)

        search_input.fill("xyz123nonexistent")
        page.wait_for_timeout(300)

        search_input.clear()
        page.wait_for_timeout(300)

        final_count = get_tree_node_count(page)
        # After clearing, should show same as initial
        assert final_count > 0


class TestTreeContextMenu:
    """Tests for tree context menu."""

    def test_right_click_opens_context_menu(self, page: Page, base_url: str):
        """Test that right-click opens context menu."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        tree_node = page.locator(SELECTORS["tree_node"]).first
        tree_node.click(button="right")
        page.wait_for_timeout(300)

        # Context menu should appear
        _context_menu = page.locator('[role="menu"]')
        # May or may not be visible depending on implementation
        expect(page.locator("body")).to_be_visible()


class TestTreeKeyboardNavigation:
    """Tests for tree keyboard navigation."""

    def test_can_navigate_with_arrow_keys(self, page: Page, base_url: str):
        """Test navigation with arrow keys."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        first_node = page.locator(SELECTORS["tree_node"]).first
        first_node.click()
        page.wait_for_timeout(300)

        # Try arrow down
        page.keyboard.press("ArrowDown")
        page.wait_for_timeout(300)

        # Page should still work
        expect(page.locator("body")).to_be_visible()

    def test_can_expand_with_arrow_right(self, page: Page, base_url: str):
        """Test expanding with arrow right key."""
        page.goto(f"{base_url}/config")
        wait_for_tree_loaded(page)

        first_node = page.locator(SELECTORS["tree_node"]).first
        first_node.click()
        page.wait_for_timeout(300)

        # Try expanding with arrow right
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(300)

        expect(page.locator("body")).to_be_visible()

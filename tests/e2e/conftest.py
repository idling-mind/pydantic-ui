"""Pytest configuration for E2E tests."""

import pytest


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args: dict) -> dict:
    """Configure browser context with default options."""
    return {
        **browser_context_args,
        "viewport": {"width": 1280, "height": 720},
    }


@pytest.fixture(scope="session")
def base_url() -> str:
    """Base URL for the application."""
    return "http://localhost:8000"

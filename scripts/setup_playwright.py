"""
Script to set up Playwright for Python E2E tests.

This script:
1. Checks if Playwright is installed
2. Installs Playwright browsers
3. Verifies the installation
"""

import subprocess
import sys
from pathlib import Path


def run_command(cmd: list[str], description: str) -> bool:
    """Run a command and return success status."""
    print(f"\n{description}...")
    try:
        result = subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            text=True,
        )
        print(f"✓ {description} completed successfully")
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ {description} failed")
        if e.stderr:
            print(f"Error: {e.stderr}")
        return False
    except FileNotFoundError:
        print(f"✗ Command not found: {cmd[0]}")
        return False


def main():
    """Main setup function."""
    print("=" * 60)
    print("Playwright Setup for Python E2E Tests")
    print("=" * 60)

    # Check if we're in the right directory
    if not Path("pyproject.toml").exists():
        print("Error: Please run this script from the project root directory")
        sys.exit(1)

    # Step 1: Install Python dependencies
    print("\n1. Installing Python dependencies...")
    success = run_command(
        ["uv", "pip", "install", "-e", ".[dev]"],
        "Installing dependencies with uv",
    )

    if not success:
        print("\nTrying with pip...")
        success = run_command(
            ["pip", "install", "-e", ".[dev]"],
            "Installing dependencies with pip",
        )

    if not success:
        print("\n✗ Failed to install dependencies")
        print("Please install dependencies manually:")
        print("  uv pip install -e .[dev]")
        print("  OR")
        print("  pip install -e .[dev]")
        sys.exit(1)

    # Step 2: Install Playwright browsers
    print("\n2. Installing Playwright browsers...")

    # Try to install all browsers
    success = run_command(
        ["playwright", "install"],
        "Installing all Playwright browsers",
    )

    if not success:
        # Try chromium only as fallback
        success = run_command(
            ["playwright", "install", "chromium"],
            "Installing Chromium browser",
        )

    if not success:
        print("\n✗ Failed to install Playwright browsers")
        print("Please install browsers manually:")
        print("  playwright install")
        sys.exit(1)

    # Step 3: Verify installation
    print("\n3. Verifying installation...")

    try:
        import playwright

        print(f"✓ Playwright Python package installed (version {playwright.__version__})")
    except ImportError:
        print("✗ Playwright Python package not found")
        sys.exit(1)

    # Check if browsers are installed
    print("\n4. Checking installed browsers...")
    result = subprocess.run(
        ["playwright", "install", "--dry-run"],
        capture_output=True,
        text=True,
    )

    if "chromium" in result.stdout.lower():
        print("✓ Chromium browser ready")
    if "firefox" in result.stdout.lower():
        print("✓ Firefox browser ready")
    if "webkit" in result.stdout.lower():
        print("✓ WebKit browser ready")

    # Success message
    print("\n" + "=" * 60)
    print("✓ Playwright setup completed successfully!")
    print("=" * 60)
    print("\nYou can now run E2E tests:")
    print("  uv run pytest tests/e2e/")
    print("\nFor more information, see tests/e2e/README.md")
    print("=" * 60)


if __name__ == "__main__":
    main()

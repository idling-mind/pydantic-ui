# Playwright E2E Testing Guide for pydantic-ui

This guide provides comprehensive information about the Playwright end-to-end testing setup for the pydantic-ui framework.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Test Architecture](#test-architecture)
4. [Running Tests](#running-tests)
5. [Writing Tests](#writing-tests)
6. [CI/CD Integration](#cicd-integration)
7. [Debugging](#debugging)
8. [Best Practices](#best-practices)

## Overview

The pydantic-ui project uses [Playwright](https://playwright.dev/) for end-to-end testing. Playwright provides:

- **Cross-browser testing**: Chromium, Firefox, and WebKit support
- **Auto-wait**: Automatically waits for elements to be ready
- **Reliable execution**: Reduces flaky tests with smart waiting
- **Debugging tools**: UI mode, trace viewer, inspector
- **CI-friendly**: Easy integration with GitHub Actions

### Test Coverage

Our E2E tests cover:

✅ Application initialization and loading  
✅ API integration (schema, data, config endpoints)  
✅ Tree navigation and node selection  
✅ All field renderer types (text, number, boolean, select, date, color)  
✅ CRUD operations (create, read, update, delete)  
✅ Form validation and error handling  
✅ Theme switching (light/dark/system)  
✅ Responsive design (mobile, tablet, desktop)  
✅ Custom action buttons  
✅ Keyboard navigation  
✅ Array operations (add, remove, reorder)  

## Installation

### Prerequisites

- **Node.js 18+** (recommend 20 LTS)
- **Python 3.10+**
- **uv** package manager (install with: `pip install uv` or see https://github.com/astral-sh/uv)

### Setup Steps

1. **Navigate to frontend directory:**

   ```bash
   cd frontend
   ```

2. **Run the setup script:**

   ```powershell
   # Windows
   .\setup-playwright.ps1
   ```

   This script will:
   - Install npm dependencies
   - Install Playwright browsers
   - Build the frontend
   - Check Python environment (requires `uv sync` from project root)

   Or manually:

   ```bash
   # Install dependencies
   npm install
   
   # Install Playwright browsers
   npx playwright install
   
   # Install system dependencies (Linux)
   npx playwright install-deps
   
   # Build frontend
   npm run build
   
   # Set up Python environment (from project root)
   cd ..
   uv sync
   cd frontend
   ```

3. **Verify installation:**

   ```bash
   npx playwright --version
   ```

## Test Architecture

### File Structure

```
frontend/e2e/
├── README.md                    # E2E test documentation
├── helpers.ts                   # Common utilities and helpers
├── app.spec.ts                  # Basic app functionality
├── tree-navigation.spec.ts      # Tree panel tests
├── field-renderers.spec.ts      # Input field tests
├── data-operations.spec.ts      # CRUD operation tests
└── ui-config.spec.ts           # UI customization tests
```

### Test Organization

Each test file follows this structure:

```typescript
import { test, expect } from '@playwright/test';
import { waitForAppLoad } from './helpers';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Navigate and wait for app to load
    await page.goto('/config');
    await waitForAppLoad(page);
  });

  test('specific behavior', async ({ page }) => {
    // Test implementation
  });
});
```

### Helper Functions

The `helpers.ts` file provides reusable utilities:

| Function | Description |
|----------|-------------|
| `waitForAppLoad(page)` | Wait for schema, data, and config APIs |
| `clickTreeNode(page, pattern)` | Find and click a tree node |
| `expandTreeNode(page, pattern)` | Expand a collapsible tree node |
| `getFirstInput(page, type)` | Get first visible input of type |
| `saveData(page)` | Click save and wait for response |
| `resetData(page)` | Click reset button |
| `switchTheme(page, mode)` | Change theme to light/dark/system |
| `getConfig(page)` | Fetch config from API |
| `getSchema(page)` | Fetch schema from API |
| `getData(page)` | Fetch data from API |
| `isDarkMode(page)` | Check if dark theme is active |

## Running Tests

### All Tests

```bash
npm run test:e2e
```

### Interactive UI Mode

Best for development - run and watch tests in real-time:

```bash
npm run test:e2e:ui
```

Features:
- Pick which tests to run
- Time travel through test execution
- Watch mode (re-runs on file changes)
- View screenshots and traces

### Headed Mode

See the browser while tests run:

```bash
npm run test:e2e:headed
```

### Debug Mode

Step through tests with debugger:

```bash
npm run test:e2e:debug
```

### Specific Tests

```bash
# Run single file
npx playwright test tree-navigation.spec.ts

# Run tests matching pattern
npx playwright test -g "can edit text"

# Run on specific browser
npx playwright test --project=chromium

# Run with multiple workers
npx playwright test --workers=4
```

### Generate HTML Report

```bash
npx playwright show-report
```

## Writing Tests

### Basic Test Template

```typescript
import { test, expect } from '@playwright/test';
import { waitForAppLoad, saveData } from './helpers';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/config');
    await waitForAppLoad(page);
  });

  test('should do something', async ({ page }) => {
    // Arrange: Setup test preconditions
    const input = page.locator('input[type="text"]').first();
    
    // Act: Perform action
    await input.fill('test value');
    await saveData(page);
    
    // Assert: Verify outcome
    await expect(input).toHaveValue('test value');
  });
});
```

### Locator Best Practices

Priority order:

1. **Role-based** (most semantic):
   ```typescript
   page.getByRole('button', { name: 'Save' })
   page.getByRole('textbox', { name: 'Email' })
   ```

2. **Test IDs** (most stable):
   ```typescript
   page.locator('[data-testid="save-button"]')
   ```

3. **Text content**:
   ```typescript
   page.getByText('Save Changes')
   ```

4. **CSS selectors** (last resort):
   ```typescript
   page.locator('button.save')
   ```

### Waiting Strategies

```typescript
// Wait for element
await page.locator('button').waitFor({ state: 'visible' });

// Wait for API response
await page.waitForResponse(response => 
  response.url().includes('/api/data') && response.status() === 200
);

// Wait for URL change
await page.waitForURL('**/settings');

// Wait for network idle
await page.waitForLoadState('networkidle');

// Wait for specific timeout (use sparingly)
await page.waitForTimeout(500);
```

### Assertions

```typescript
// Visibility
await expect(element).toBeVisible();
await expect(element).not.toBeVisible();

// Values
await expect(input).toHaveValue('expected');
await expect(element).toHaveText('expected');
await expect(element).toContainText('partial');

// Attributes
await expect(element).toHaveAttribute('disabled');
await expect(element).toHaveClass(/active/);

// Count
await expect(elements).toHaveCount(3);

// State
await expect(checkbox).toBeChecked();
await expect(button).toBeEnabled();
```

### Handling Dynamic Content

```typescript
// Wait for specific condition
await page.waitForFunction(() => {
  return document.querySelectorAll('.item').length > 5;
});

// Poll until condition met
await expect.poll(async () => {
  const count = await page.locator('.item').count();
  return count;
}).toBeGreaterThan(5);

// Retry assertions
await expect(async () => {
  const value = await getValue();
  expect(value).toBe('expected');
}).toPass();
```

### Testing Forms

```typescript
test('form validation', async ({ page }) => {
  await page.goto('/config');
  await waitForAppLoad(page);
  
  // Fill form
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  
  // Submit
  await page.click('button[type="submit"]');
  
  // Verify success
  await expect(page.getByText('Success')).toBeVisible();
});
```

### Testing API Integration

```typescript
test('saves data to backend', async ({ page }) => {
  // Setup response listener before action
  const saveResponse = page.waitForResponse(
    response => response.url().includes('/api/data') && 
               response.request().method() === 'POST'
  );
  
  // Trigger save
  await page.fill('input[name="field"]', 'value');
  await page.click('button:text("Save")');
  
  // Verify response
  const response = await saveResponse;
  expect(response.status()).toBe(200);
  
  const body = await response.json();
  expect(body).toHaveProperty('success', true);
});
```

### Testing Responsive Design

```typescript
test.describe('mobile layout', () => {
  test.use({ 
    viewport: { width: 375, height: 667 } 
  });
  
  test('shows mobile menu', async ({ page }) => {
    await page.goto('/config');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
  });
});
```

## CI/CD Integration

### GitHub Actions

A workflow file is provided at `.github/workflows/e2e-tests.yml`.

**Triggered on:**
- Push to `main` or `develop` branches
- Pull requests to `main`

**Features:**
- Runs on Ubuntu
- Tests both Chromium and Firefox
- Uploads test results as artifacts
- Retries failed tests automatically
- Generates HTML reports

### Local CI Simulation

```bash
# Run with CI environment variable
CI=true npm run test:e2e
```

This enables:
- GitHub reporter
- Retry on failure (2 attempts)
- Sequential execution
- No reusing existing server

## Debugging

### 1. UI Mode (Recommended)

```bash
npm run test:e2e:ui
```

**Features:**
- Pick and run individual tests
- Watch test execution step-by-step
- View screenshots at each step
- Time-travel debugging

### 2. Debug Mode

```bash
npm run test:e2e:debug
```

Opens Playwright Inspector for:
- Step-by-step execution
- Pausing test execution
- Evaluating expressions
- Viewing element selectors

### 3. VS Code Extension

Install [Playwright Test for VS Code](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright)

**Features:**
- Run tests from editor
- Set breakpoints
- View test results inline
- Debug with VS Code debugger

### 4. Trace Viewer

For failed tests, Playwright captures traces automatically.

```bash
npx playwright show-trace trace.zip
```

**Trace includes:**
- DOM snapshots
- Network activity
- Console logs
- Screenshots
- Test source code

### 5. Screenshots and Videos

```typescript
// Take screenshot
await page.screenshot({ path: 'screenshot.png' });

// Full page screenshot
await page.screenshot({ 
  path: 'screenshot.png', 
  fullPage: true 
});
```

Configure in `playwright.config.ts`:
```typescript
use: {
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'on-first-retry',
}
```

### 6. Console Logs

```typescript
page.on('console', msg => console.log('Browser log:', msg.text()));
page.on('pageerror', err => console.log('Page error:', err));
```

## Best Practices

### 1. Test Independence

Each test should run independently:

```typescript
// ❌ Bad - tests depend on each other
test('create user', async ({ page }) => {
  await createUser('john');
});

test('edit user', async ({ page }) => {
  await editUser('john'); // Depends on previous test
});

// ✅ Good - each test is independent
test('create user', async ({ page }) => {
  await createUser('john');
});

test('edit user', async ({ page }) => {
  await createUser('jane'); // Creates its own data
  await editUser('jane');
});
```

### 2. Use Page Object Model (for complex apps)

```typescript
// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}
  
  async goto() {
    await this.page.goto('/login');
  }
  
  async login(email: string, password: string) {
    await this.page.fill('[name="email"]', email);
    await this.page.fill('[name="password"]', password);
    await this.page.click('button[type="submit"]');
  }
}

// test file
import { LoginPage } from './pages/LoginPage';

test('user can login', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@test.com', 'password');
});
```

### 3. Avoid Hard Waits

```typescript
// ❌ Bad
await page.waitForTimeout(5000);

// ✅ Good
await page.waitForResponse(r => r.url().includes('/api/data'));
await expect(page.locator('button')).toBeVisible();
```

### 4. Use Fixtures for Setup

```typescript
// fixtures.ts
export const test = base.extend<{ 
  authenticatedPage: Page 
}>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await login(page);
    await use(page);
  },
});

// test file
import { test } from './fixtures';

test('authenticated test', async ({ authenticatedPage }) => {
  // Page is already authenticated
});
```

### 5. Group Related Tests

```typescript
test.describe('Form Validation', () => {
  test('validates required fields', async ({ page }) => {});
  test('validates email format', async ({ page }) => {});
  test('validates password strength', async ({ page }) => {});
});
```

### 6. Handle Flaky Tests

```typescript
// Retry specific test
test('flaky test', async ({ page }) => {
  test.fixme(); // Mark as known issue
  // or
  test.slow(); // Give more time
});

// Configure retries in playwright.config.ts
retries: process.env.CI ? 2 : 0
```

### 7. Test Data Management

```typescript
// Use factories for test data
function createUser(overrides = {}) {
  return {
    name: 'Test User',
    email: 'test@example.com',
    ...overrides
  };
}

test('creates user', async ({ page }) => {
  const user = createUser({ name: 'John' });
  await createUserInApp(page, user);
});
```

### 8. Accessibility Testing

```typescript
// Use axe for a11y testing
import { injectAxe, checkA11y } from 'axe-playwright';

test('page is accessible', async ({ page }) => {
  await page.goto('/config');
  await injectAxe(page);
  await checkA11y(page);
});
```

## Troubleshooting

### Server Won't Start

**Issue**: Test server fails to start or times out

**Solutions**:
- Verify Python environment: `uv run python --version` (from project root)
- Install dependencies: `uv sync` (from project root)
- Test server manually: `uv run python -m uvicorn examples.main:app`
- Check port availability: `netstat -an | findstr :8000` (Windows) or `lsof -i :8000` (macOS/Linux)
- Increase timeout in `playwright.config.ts`

### Tests Pass Locally But Fail in CI

**Possible causes**:
- Timing differences (CI is usually slower)
- Environment variables not set
- Missing dependencies

**Solutions**:
- Add more explicit waits
- Use `CI` environment variable checks
- Verify all dependencies in workflow file

### Browser Not Found

```bash
npx playwright install
```

### Flaky Tests

**Common causes**:
- Race conditions
- Animations/transitions
- Network timing
- Insufficient waits

**Solutions**:
- Use `waitForResponse()` instead of `waitForTimeout()`
- Disable animations in test mode
- Increase expect timeout
- Use auto-retry assertions

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright)
- [Trace Viewer Guide](https://playwright.dev/docs/trace-viewer)
- [Community Discord](https://discord.com/invite/playwright)

## Contributing

When adding new features to pydantic-ui:

1. **Write E2E tests** covering the new functionality
2. **Follow existing patterns** in test organization
3. **Update documentation** if adding new test files
4. **Run tests locally** before committing
5. **Ensure CI passes** before merging

For questions or issues with tests, please open a GitHub issue or discussion.

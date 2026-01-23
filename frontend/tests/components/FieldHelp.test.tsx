import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FieldHelp from '@/components/FieldHelp';

describe('FieldHelp', () => {
  it('does not render when no helpText provided', () => {
    const { container } = render(<FieldHelp />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders help icon and shows markdown content in popover', async () => {
    const user = userEvent.setup();
    render(<FieldHelp helpText={"This is **bold** and [link](https://example.com)"} />);

    const button = screen.getByRole('button', { name: /field help/i });
    expect(button).toBeInTheDocument();

    // Hover to show the popover (hover behavior is supported by the component)
    await user.hover(button);

    // The markdown should be rendered inside the popover
    expect(await screen.findByText('bold')).toBeInTheDocument();
    expect(await screen.findByText('link')).toBeInTheDocument();
  });

  it('renders fenced code block with padding', async () => {
    const user = userEvent.setup();
    const codeBlock = '```
const x = 1
```';
    render(<FieldHelp helpText={codeBlock} />);

    const button = screen.getByRole('button', { name: /field help/i });
    await user.hover(button);

    // Find a pre or code element and assert it has padding class
    const pre = await screen.findByRole('textbox', { hidden: true }).catch(() => null);

    // If we can't find textbox role, fallback to query selectors
    const preEl = pre ?? document.querySelector('pre');
    const codeEl = document.querySelector('code');

    expect(preEl || codeEl).toBeTruthy();
    const el = preEl ?? codeEl;
    // Ensure one of them includes the p-3 padding utility
    const classList = (el as Element).className;
    expect(classList.includes('p-3')).toBe(true);
  });
});

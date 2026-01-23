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
});

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card, CardTitle, CardDescription } from '@/components/ui/card'

describe('Card UI component', () => {
  it('applies truncation and width constraints to prevent overflow', () => {
    render(
      <Card>
        <CardTitle>Very long title that should be truncated and not cause overflow</CardTitle>
        <CardDescription>Very long description that should also be truncated so the card stays within the column and does not expand the layout</CardDescription>
      </Card>
    )

    const card = screen.getByText(/Very long title/).closest('div')
    expect(card).toBeTruthy()

    // Card container should constrain width and hide overflow
    // Note: classnames are merged, check substrings
    expect(card?.className).toMatch(/w-full/)
    expect(card?.className).toMatch(/overflow-hidden/)

    // Title and description should include truncate class
    const title = screen.getByText(/Very long title/)
    expect(title.className).toMatch(/truncate/)

    const desc = screen.getByText(/Very long description/)
    expect(desc.className).toMatch(/truncate/)
  })
})

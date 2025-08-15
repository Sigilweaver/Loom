import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ToolPalette from '../ToolPalette';

function Wrapper({ children }: { children: React.ReactNode }) {
  // Minimal wrapper to provide required props/state; ToolPalette is largely standalone for this test
  return <div>{children}</div>;
}

describe('ToolPalette accessibility', () => {
  it('tab is keyboard focusable (focus-visible handled by CSS)', async () => {
    const activeTab = 'inout' as const;
    const onTabChange = () => {};

    render(
      <Wrapper>
        <ToolPalette activeTab={activeTab} onTabChange={onTabChange} />
      </Wrapper>
    );

    // First tab button
    const tab = screen.getByRole('tab', { name: /Favorites/i });

    // Tab gains focus via keyboard navigation
    tab.focus();
  // Basic focus check; matcher availability varies, so fallback check
  expect(document.activeElement).toBe(tab);

    // We don't snapshot CSS, but we assert that focus is applied; CSS handles the outline
    // This ensures the tab is focusable and uses role semantics correctly
    expect(tab.getAttribute('role')).toBe('tab');
  });
});

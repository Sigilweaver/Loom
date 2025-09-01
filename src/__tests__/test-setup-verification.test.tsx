import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// Simple test component to verify setup
function TestComponent() {
  return <div data-testid="test-component">Hello Test</div>;
}

describe('Test Environment Setup', () => {
  test('renders simple component correctly', () => {
    render(<TestComponent />);
    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByTestId('test-component')).toHaveTextContent('Hello Test');
  });
});

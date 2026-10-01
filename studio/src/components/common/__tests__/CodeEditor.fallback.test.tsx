import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { CodeEditor } from '../CodeEditor';

// Simulate the editor bundle failing to load (offline / blocked CDN)
vi.mock('@monaco-editor/react', () => ({
  Editor: () => <div data-testid="monaco-editor-mock" />,
  loader: { init: () => Promise.reject(new Error('offline')) },
}));

describe('CodeEditor fallback', () => {
  it('falls back to a plain text box when the editor cannot load', async () => {
    const onChange = vi.fn();
    render(
      <ThemeProvider>
        <CodeEditor value="pl.col('a')" onChange={onChange} placeholder="Enter an expression" />
      </ThemeProvider>
    );

    const textbox = await screen.findByRole('textbox', { name: 'Expression' });
    expect((textbox as HTMLTextAreaElement).value).toBe("pl.col('a')");
    expect(screen.queryByTestId('monaco-editor-mock')).toBeNull();

    fireEvent.change(textbox, { target: { value: 'pl.col("b")' } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('pl.col("b")'));
    expect(screen.getByText(/plain text box/)).toBeTruthy();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@contexts/ThemeContext";
import LogViewer from "../LogViewer";

describe("LogViewer", () => {
  it("renders empty state when no logs are provided", () => {
    render(
      <ThemeProvider>
        <LogViewer />
      </ThemeProvider>
    );

    expect(screen.getByText(/No logs available/i)).toBeInTheDocument();
  });

  it("renders logs correctly", () => {
    const logs = [
      "Starting execution...",
      "Processing row 1",
      "Processing row 2",
      "Completed successfully",
    ];

    render(
      <ThemeProvider>
        <LogViewer logs={logs} />
      </ThemeProvider>
    );

    logs.forEach((log) => {
      expect(screen.getByText(log)).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@contexts/ThemeContext";
import LogViewer from "../LogViewer";
import { useExecutionStore } from "@state/executionStore";

describe("LogViewer", () => {
  beforeEach(() => {
    // Clear logs before each test
    useExecutionStore.getState().clearLogs();
  });

  it("renders empty state when no logs are provided", () => {
    render(
      <ThemeProvider>
        <LogViewer />
      </ThemeProvider>
    );

    expect(screen.getByText(/No logs available/i)).toBeInTheDocument();
  });

  it("renders logs correctly", () => {
    // Add logs to the store
    const addLog = useExecutionStore.getState().addLog;
    addLog({ level: "info", message: "Starting execution..." });
    addLog({ level: "info", message: "Processing row 1" });
    addLog({ level: "info", message: "Processing row 2" });
    addLog({ level: "success", message: "Completed successfully" });

    render(
      <ThemeProvider>
        <LogViewer />
      </ThemeProvider>
    );

    expect(screen.getByText("Starting execution...")).toBeInTheDocument();
    expect(screen.getByText("Processing row 1")).toBeInTheDocument();
    expect(screen.getByText("Processing row 2")).toBeInTheDocument();
    expect(screen.getByText("Completed successfully")).toBeInTheDocument();
  });
});

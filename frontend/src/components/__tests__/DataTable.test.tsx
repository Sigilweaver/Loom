import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@contexts/ThemeContext";
import { useUIStore } from "@state/uiStore";
import DataTable from "../DataTable";

describe("DataTable", () => {
  beforeEach(() => {
    // Clear preview state before each test
    useUIStore.setState({ previewState: null });
  });

  it("renders empty state when no data is provided", () => {
    render(
      <ThemeProvider>
        <DataTable />
      </ThemeProvider>
    );

    expect(
      screen.getByText(/Click a socket on the canvas/i)
    ).toBeInTheDocument();
  });

  it("renders loading state", () => {
    useUIStore.setState({
      previewState: {
        toolId: "tool1",
        socketId: 0,
        socketDirection: "output",
        data: [],
        schema: [],
        loading: true,
        error: null,
      },
    });

    render(
      <ThemeProvider>
        <DataTable />
      </ThemeProvider>
    );

    expect(screen.getByText(/Loading preview/i)).toBeInTheDocument();
  });

  it("renders error state", () => {
    useUIStore.setState({
      previewState: {
        toolId: "tool1",
        socketId: 0,
        socketDirection: "output",
        data: [],
        schema: [],
        loading: false,
        error: "Connection failed",
      },
    });

    render(
      <ThemeProvider>
        <DataTable />
      </ThemeProvider>
    );

    expect(screen.getByText(/Error: Connection failed/i)).toBeInTheDocument();
  });

  it("renders schema and data correctly", () => {
    useUIStore.setState({
      previewState: {
        toolId: "tool1",
        socketId: 0,
        socketDirection: "output",
        schema: [
          { name: "id", dtype: "Int64", nullable: false },
          { name: "name", dtype: "Utf8", nullable: true },
        ],
        data: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ],
        loading: false,
        error: null,
      },
    });

    render(
      <ThemeProvider>
        <DataTable />
      </ThemeProvider>
    );

    // Check header
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("Int64")).toBeInTheDocument();
    expect(screen.getByText(/Utf8.*nullable/)).toBeInTheDocument();

    // Check data
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    // Check header exists with row/column info
    const header = screen.getByText((_content, element) => {
      return element?.textContent === "2 rows × 2 columns";
    });
    expect(header).toBeInTheDocument();
  });

  it("renders null values correctly", () => {
    useUIStore.setState({
      previewState: {
        toolId: "tool1",
        socketId: 0,
        socketDirection: "output",
        schema: [{ name: "value", dtype: "Int64", nullable: true }],
        data: [{ value: null }, { value: 42 }],
        loading: false,
        error: null,
      },
    });

    render(
      <ThemeProvider>
        <DataTable />
      </ThemeProvider>
    );

    expect(screen.getByText("null")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});

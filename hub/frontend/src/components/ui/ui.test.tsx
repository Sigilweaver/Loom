import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ActionMenu,
  Alert,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  Field,
  FeedbackProvider,
  IconButton,
  Input,
  Modal,
  Pagination,
  SegmentedControl,
  useConfirm,
  useToast,
} from "./index";

vi.mock("@state/authStore", () => ({ getAuthToken: () => null, expireSession: () => {} }));

describe("Button", () => {
  it("fires onClick and defaults to type=button", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and marked busy while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("IconButton", () => {
  it("exposes its label as the accessible name", () => {
    render(
      <IconButton label="Delete workflow">
        <svg />
      </IconButton>
    );
    expect(screen.getByRole("button", { name: "Delete workflow" })).toBeInTheDocument();
  });
});

describe("Field", () => {
  it("connects the label to the control", () => {
    render(
      <Field label="Username">
        <Input />
      </Field>
    );
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });

  it("announces errors and marks the control invalid", () => {
    render(
      <Field label="Username" error="Too short" hint="3+ characters">
        <Input />
      </Field>
    );
    const input = screen.getByLabelText("Username");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Too short");
    expect(input).toHaveAccessibleDescription("Too short");
    expect(screen.queryByText("3+ characters")).not.toBeInTheDocument();
  });

  it("shows the hint when there is no error", () => {
    render(
      <Field label="Folder" hint="Type a path">
        <Input />
      </Field>
    );
    expect(screen.getByLabelText("Folder")).toHaveAccessibleDescription("Type a path");
  });

  it("marks required fields visually without polluting the label text", () => {
    render(
      <Field label="Name" required>
        <Input required />
      </Field>
    );
    expect(screen.getByLabelText(/Name/)).toBeRequired();
  });
});

describe("Checkbox", () => {
  it("toggles through its label", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Live updates" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Live updates"));
    expect(onChange).toHaveBeenCalled();
  });
});

describe("Alert and states", () => {
  it("announces errors with role=alert and other tones as status", () => {
    const { rerender } = render(<Alert tone="danger">Broken</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Broken");
    rerender(<Alert tone="info">FYI</Alert>);
    expect(screen.getByRole("status")).toHaveTextContent("FYI");
  });

  it("dismisses an alert", async () => {
    const onDismiss = vi.fn();
    render(<Alert onDismiss={onDismiss}>Oops</Alert>);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("ErrorState offers a retry", async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Could not load" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load");
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("EmptyState shows title, description and action", () => {
    render(
      <EmptyState title="No workflows yet" description="Upload one" action={<button>Upload</button>} />
    );
    expect(screen.getByRole("heading", { name: "No workflows yet" })).toBeInTheDocument();
    expect(screen.getByText("Upload one")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });
});

describe("Modal", () => {
  function Harness({ onSubmit }: { onSubmit?: () => void }) {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Edit thing"
          description="Change it"
          onSubmit={
            onSubmit
              ? (e) => {
                  e.preventDefault();
                  onSubmit();
                }
              : undefined
          }
          footer={<Button type="submit">Save</Button>}
        >
          <Input aria-label="Name" />
        </Modal>
      </>
    );
  }

  it("renders an accessible dialog with title and description", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog", { name: "Edit thing" });
    expect(dialog).toHaveAccessibleDescription("Change it");
  });

  it("closes on Escape and via the close button", async () => {
    render(<Harness />);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("submits the wrapped form from the footer button", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("cannot be dismissed while not dismissable", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Working" dismissable={false}>
        body
      </Modal>
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Feedback", () => {
  function ConfirmHarness({ onResult }: { onResult: (ok: boolean) => void }) {
    const confirm = useConfirm();
    return (
      <button
        onClick={async () =>
          onResult(
            await confirm({
              title: "Delete workflow?",
              message: "This cannot be undone.",
              confirmLabel: "Delete",
              tone: "danger",
            })
          )
        }
      >
        Ask
      </button>
    );
  }

  it("resolves true when the user confirms", async () => {
    const onResult = vi.fn();
    render(
      <FeedbackProvider>
        <ConfirmHarness onResult={onResult} />
      </FeedbackProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByRole("dialog", { name: "Delete workflow?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it("resolves false when the user cancels", async () => {
    const onResult = vi.fn();
    render(
      <FeedbackProvider>
        <ConfirmHarness onResult={onResult} />
      </FeedbackProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it("shows toasts for errors using the friendly message", async () => {
    function ToastHarness() {
      const toast = useToast();
      return <button onClick={() => toast.error(new Error("Disk full"))}>Fail</button>;
    }
    render(
      <FeedbackProvider>
        <ToastHarness />
      </FeedbackProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: "Fail" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Disk full");
  });

  it("throws a helpful error outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ConfirmHarness onResult={() => {}} />)).toThrow(/FeedbackProvider/);
    spy.mockRestore();
  });
});

describe("Pagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(<Pagination page={0} pageSize={20} total={5} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("describes the range and navigates", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageSize={20} total={45} onPageChange={onPageChange} noun="executions" />);
    expect(screen.getByText("Showing 21-40 of 45 executions")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it("disables previous on the first page and next on the last", () => {
    const { rerender } = render(<Pagination page={0} pageSize={10} total={25} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    rerender(<Pagination page={2} pageSize={10} total={25} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });
});

describe("SegmentedControl", () => {
  it("marks the active option and reports changes", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="View"
        value="a"
        options={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
        onChange={onChange}
      />
    );
    expect(screen.getByRole("group", { name: "View" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

describe("ActionMenu", () => {
  it("opens with the keyboard and runs the chosen action", async () => {
    const onEdit = vi.fn();
    render(
      <ActionMenu
        label="Actions for Sales"
        items={[
          { label: "Edit", onSelect: onEdit },
          { label: "Delete", onSelect: () => {}, tone: "danger", separated: true },
        ]}
      />
    );
    const trigger = screen.getByRole("button", { name: "Actions for Sales" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Edit", "Delete"]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

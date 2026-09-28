import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getWorkflowDiff,
  listWorkflowRevisions,
  listWorkflows,
  replaceWorkflowFile,
  rollbackWorkflow,
  uploadWorkflow,
} from "./workflows";

vi.mock("@state/authStore", () => ({
  getAuthToken: () => "test-token",
  expireSession: () => {},
}));

function stubFetch(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    statusText: ok ? "OK" : "Bad Request",
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    blob: async () => new Blob([]),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("workflows API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps camelCase list filters to snake_case query params", async () => {
    const fetchMock = stubFetch({ workflows: [], total: 0 });

    await listWorkflows({ folder: "/ml", uploadedBy: "alice" });

    const url = new URL(fetchMock.mock.calls[0]![0], "http://localhost");
    expect(url.pathname).toBe("/api/v1/workflows");
    expect(url.searchParams.get("folder")).toBe("/ml");
    expect(url.searchParams.get("uploaded_by")).toBe("alice");
  });

  it("uploads as multipart form data with tags joined by comma", async () => {
    const fetchMock = stubFetch({ id: "1", name: "n", message: "ok" });
    const file = new File(["{}"], "a.swwf");

    await uploadWorkflow(file, "/finance", ["a", "b"], "first");

    const [, init] = fetchMock.mock.calls[0]!;
    const form = init.body as FormData;
    expect(init.method).toBe("POST");
    expect(form.get("folder_path")).toBe("/finance");
    expect(form.get("tags")).toBe("a,b");
    expect(form.get("message")).toBe("first");
  });

  it("replaces a workflow file with PUT and an optional message", async () => {
    const fetchMock = stubFetch({});

    await replaceWorkflowFile("wf-1", new File(["{}"], "a.swwf"), "fix filter");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/workflows/wf-1");
    expect(init.method).toBe("PUT");
    expect((init.body as FormData).get("message")).toBe("fix filter");
  });

  it("lists revisions from the revisions endpoint", async () => {
    const fetchMock = stubFetch({ revisions: [], total: 0 });

    await listWorkflowRevisions("wf-1");

    expect(fetchMock.mock.calls[0]![0]).toBe("/api/v1/workflows/wf-1/revisions");
  });

  it("requests a diff with from/to revision ids and returns plain text", async () => {
    const fetchMock = stubFetch("--- a\n+++ b\n");

    const diff = await getWorkflowDiff("wf-1", "rev-a", "rev-b");

    const url = new URL(fetchMock.mock.calls[0]![0], "http://localhost");
    expect(url.pathname).toBe("/api/v1/workflows/wf-1/diff");
    expect(url.searchParams.get("from")).toBe("rev-a");
    expect(url.searchParams.get("to")).toBe("rev-b");
    expect(diff).toBe("--- a\n+++ b\n");
  });

  it("rolls back with POST and an optional message body", async () => {
    const fetchMock = stubFetch({});

    await rollbackWorkflow("wf-1", "rev-2", "undo bad change");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/workflows/wf-1/revisions/rev-2/rollback");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ message: "undo bad change" });
  });
});

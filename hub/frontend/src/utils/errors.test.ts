import { describe, it, expect, vi } from "vitest";
import { ApiError } from "@api/http";
import { errorMessage, fieldError } from "./errors";

vi.mock("@state/authStore", () => ({ getAuthToken: () => null, expireSession: () => {} }));

describe("errorMessage", () => {
  it("explains an expired session", () => {
    expect(errorMessage(new ApiError(401, "Not authenticated", "Not authenticated"))).toMatch(
      /session has expired/i
    );
  });

  it("names the missing permission and keeps the server's reason", () => {
    const withReason = new ApiError(403, "Cannot update workflows uploaded by other users", "Cannot update workflows uploaded by other users");
    expect(errorMessage(withReason)).toBe(
      "You do not have permission to do this. Cannot update workflows uploaded by other users"
    );
    expect(errorMessage(new ApiError(403, "HTTP 403: Forbidden"))).toBe(
      "You do not have permission to do this."
    );
  });

  it("passes conflict and validation messages through", () => {
    expect(errorMessage(new ApiError(409, "Name already exists", "Name already exists"))).toBe(
      "Name already exists"
    );
    expect(errorMessage(new ApiError(422, "username: too short", null, { username: "too short" }))).toBe(
      "username: too short"
    );
  });

  it("hides raw HTTP text for unexplained server errors but keeps explained ones", () => {
    expect(errorMessage(new ApiError(500, "HTTP 500: Internal Server Error"))).toMatch(
      /unexpected error/i
    );
    expect(errorMessage(new ApiError(500, "Stored revision corrupted", "Stored revision corrupted"))).toBe(
      "Stored revision corrupted"
    );
  });

  it("handles plain errors and unknown values", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage("weird", "Fallback text")).toBe("Fallback text");
  });
});

describe("fieldError", () => {
  it("reads per-field messages from validation errors", () => {
    const error = new ApiError(422, "x", null, { username: "too short" });
    expect(fieldError(error, "username")).toBe("too short");
    expect(fieldError(error, "password")).toBeUndefined();
    expect(fieldError(new Error("x"), "username")).toBeUndefined();
  });
});

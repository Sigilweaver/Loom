import { describe, expect, it } from "vitest";
import { classifyError } from "../errors";

function apiError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

describe("classifyError with structured status", () => {
  it("uses statusCode over message text", () => {
    expect(classifyError(apiError(401, "nope")).category).toBe("auth");
    expect(classifyError(apiError(429, "slow down")).category).toBe("rate-limit");
    expect(classifyError(apiError(529, "busy")).category).toBe("overloaded");
    expect(classifyError(apiError(502, "bad gateway")).category).toBe("network");
  });

  it("does not misread numbers in an unrelated message when a status exists", () => {
    // 400 with "401 rows" must not become an auth error
    const r = classifyError(apiError(400, "Invalid request: expected 401 rows"));
    expect(r.category).toBe("unknown");
  });

  it("reports a missing model distinctly", () => {
    const r = classifyError(apiError(404, "model: gpt-x"));
    expect(r.category).toBe("model-not-found");
    expect(r.retryable).toBe(false);
  });

  it("reports context overflow distinctly", () => {
    expect(classifyError(apiError(400, "prompt is too long: 250000 tokens")).category).toBe("context-length");
    expect(classifyError(apiError(413, "payload")).category).toBe("context-length");
  });

  it("reads the status from a wrapped cause", () => {
    const err = Object.assign(new Error("wrapped"), { cause: apiError(429, "rl") });
    expect(classifyError(err).category).toBe("rate-limit");
  });
});

describe("classifyError message fallback", () => {
  it("detects model-not-found and context errors from text", () => {
    expect(classifyError("The model `foo` does not exist").category).toBe("model-not-found");
    expect(classifyError("context_length_exceeded").category).toBe("context-length");
  });
});

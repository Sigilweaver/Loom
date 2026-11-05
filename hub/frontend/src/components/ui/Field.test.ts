import { describe, expect, it } from "vitest";
import { controlClasses } from "./Field";

describe("controlClasses", () => {
  const classes = (className?: string) => controlClasses(false, className).split(/\s+/);

  it("fills the container by default", () => {
    expect(classes()).toContain("w-full");
  });

  it("lets the caller choose a base width", () => {
    expect(classes("w-auto")).not.toContain("w-full");
    expect(classes("w-40 mt-2")).toContain("w-40");
    expect(classes("w-40 mt-2")).not.toContain("w-full");
  });

  it("keeps the full width when only a breakpoint width is given", () => {
    expect(classes("sm:w-48")).toContain("w-full");
  });
});

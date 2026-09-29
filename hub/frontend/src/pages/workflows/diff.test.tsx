import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { parseUnifiedDiff, summarizeDiff } from "./diff";
import { DescriptionText } from "./DescriptionText";

const DIFF = [
  "--- revision 1",
  "+++ revision 2",
  "@@ -1,3 +1,3 @@",
  " {",
  '-  "name": "old",',
  '+  "name": "new",',
  " }",
  "",
].join("\n");

describe("parseUnifiedDiff", () => {
  it("classifies each line of a unified diff", () => {
    expect(parseUnifiedDiff(DIFF).map((line) => line.kind)).toEqual([
      "meta",
      "meta",
      "hunk",
      "context",
      "remove",
      "add",
      "context",
    ]);
  });

  it("returns no lines when the versions are identical", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
    expect(parseUnifiedDiff("  \n")).toEqual([]);
  });

  it("counts added and removed lines but not file headers", () => {
    expect(summarizeDiff(parseUnifiedDiff(DIFF))).toEqual({ added: 1, removed: 1 });
  });
});

describe("DescriptionText", () => {
  it("renders headings, lists and inline formatting", () => {
    render(
      <DescriptionText
        text={"## Overview\n\nRuns **daily** and calls `load()`.\n\n- first\n- second\n\n1. one\n2. two"}
      />
    );
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText("daily").tagName).toBe("STRONG");
    expect(screen.getByText("load()").tagName).toBe("CODE");
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "first",
      "second",
      "one",
      "two",
    ]);
  });

  it("shows bold and code in the same paragraph", () => {
    render(<DescriptionText text="**bold** and `code`" />);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("code").tagName).toBe("CODE");
  });

  it("never interprets HTML", () => {
    const { container } = render(<DescriptionText text={'<img src=x onerror="alert(1)"> hi'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent('<img src=x onerror="alert(1)"> hi');
  });

  it("renders nothing for empty text", () => {
    const { container } = render(<DescriptionText text="" />);
    expect(container).toBeEmptyDOMElement();
  });
});

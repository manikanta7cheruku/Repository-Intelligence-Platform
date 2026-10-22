import { describe, expect, it } from "vitest";
import { countLines } from "./loc.js";

describe("countLines", () => {
  it("separates code, comment and blank lines for TypeScript", () => {
    const text = [
      'const a = "http://x"; // trailing',
      "/* block",
      " more */",
      "",
      "let t = `a",
      "// inside template",
      "`;",
      "",
    ].join("\n");
    expect(countLines(text, "typescript")).toEqual({
      lines: 7,
      code: 4,
      comment: 2,
      blank: 1,
      commentAware: true,
    });
  });
  it("treats python docstrings as code and hash lines as comments", () => {
    const text = ['"""doc', "still doc", '"""', "# note", "x = 1  # trailing", ""].join("\n");
    const r = countLines(text, "python");
    expect(r.code).toBe(4);
    expect(r.comment).toBe(1);
  });
  it("does not start a comment inside a string", () => {
    expect(countLines('const u = "// not a comment";', "typescript").comment).toBe(0);
  });
  it("counts everything non-blank as code for languages without a table", () => {
    const r = countLines("a\n\nb\n", "brainfuck-like");
    expect(r).toEqual({ lines: 3, code: 2, comment: 0, blank: 1, commentAware: false });
  });
  it("handles CRLF and an empty file", () => {
    expect(countLines("a\r\nb\r\n", "go").lines).toBe(2);
    expect(countLines("", "go").lines).toBe(0);
  });
});

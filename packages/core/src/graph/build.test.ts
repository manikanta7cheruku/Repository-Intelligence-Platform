import { describe, expect, it } from "vitest";
import { moduleOf } from "./build.js";

describe("moduleOf", () => {
  it("uses the first directory under src", () => {
    expect(moduleOf("src/domain/user/model.ts", [""], 1)).toEqual({
      path: "src/domain",
      kind: "directory",
    });
    expect(moduleOf("src/index.ts", [""], 1).path).toBe("src");
    expect(moduleOf("index.ts", [""], 1).path).toBe("(root)");
  });
  it("uses the package directory plus src for workspace packages", () => {
    expect(moduleOf("packages/core/src/graph/a.ts", ["", "packages/core"], 1)).toEqual({
      path: "packages/core/src/graph",
      kind: "package",
    });
    expect(moduleOf("packages/core/src/a.ts", ["", "packages/core"], 1).path).toBe(
      "packages/core/src",
    );
  });
  it("prefers the deepest package directory", () => {
    expect(
      moduleOf("packages/a/nested/b/src/x.ts", ["", "packages/a", "packages/a/nested/b"], 1).path,
    ).toBe("packages/a/nested/b/src");
  });
  it("honors a deeper module depth", () => {
    expect(moduleOf("src/a/b/c/d.ts", [""], 2).path).toBe("src/a/b");
  });
  it("works for python style packages without a src directory", () => {
    expect(moduleOf("pkg/sub/m.py", [""], 1).path).toBe("pkg");
  });
});

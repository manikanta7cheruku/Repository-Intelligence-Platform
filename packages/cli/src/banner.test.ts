import { describe, expect, it } from "vitest";
import { getBanner } from "./banner.js";

describe("cli skeleton", () => {
  it("prints a banner", () => {
    expect(getBanner()).toContain("RepoLens CLI");
  });
});

import { describe, expect, it } from "vitest";
import { compareVersions, nearestFix, parseVersion } from "./semver.js";

describe("semver helpers", () => {
  it("compares dotted versions numerically", () => {
    expect(compareVersions("1.10.0", "1.9.9")).toBe(1);
    expect(compareVersions("2.0", "2.0.0")).toBe(0);
    expect(compareVersions("1.0.0-beta.1", "1.0.0")).toBe(-1);
    expect(compareVersions("0.21.5", "0.25.0")).toBe(-1);
  });
  it("parses and rejects", () => {
    expect(parseVersion("v1.2.3")?.parts).toEqual([1, 2, 3]);
    expect(parseVersion("abc123def")).toBeNull();
  });
  it("picks the nearest fix above the installed version, preferring the same major", () => {
    expect(nearestFix("5.4.21", ["1.1.0", "6.4.4", "7.3.7", "5.4.22"])).toEqual({
      version: "5.4.22",
      jump: "patch",
    });
    expect(nearestFix("5.4.21", ["6.4.4", "7.3.7"])).toEqual({ version: "6.4.4", jump: "major" });
    expect(nearestFix("0.21.5", ["0.25.0"])).toEqual({ version: "0.25.0", jump: "minor" });
  });
  it("returns null when nothing is above the installed version or versions are not comparable", () => {
    expect(nearestFix("2.0.0", ["1.0.0"])).toBeNull();
    expect(nearestFix("2.0.0", ["deadbeef"])).toBeNull();
  });
});

import { a } from "@app/feature/a";
import { lib } from "@lib";
import { util } from "./utils";
import data from "./data.json";
const legacy = require("./legacy.cjs");
export async function boot(name: string): Promise<unknown> {
  const lazy = await import("./lazy");
  const other = await import(name);
  return [a, lib, util, data, legacy, lazy, other];
}

import { readFileSync } from "fs";
import { z } from "zod";
export class Repo { load(n: string): string { return z.string().parse(readFileSync(n, "utf8")); } }

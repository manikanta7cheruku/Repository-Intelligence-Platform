import path from "node:path";
import { Service } from "../domain/service";
import { fmt } from "./format.js";
export function render(): string { return fmt(path.basename(String(Service))); }

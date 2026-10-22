import { render } from "./ui/app";
import { start } from "./domain/service";
export function main(): void { start(); render(); }

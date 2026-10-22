import { Repo } from "../data/repo";
import type { User } from "./model";
export class Service { run(u: User): string { return new Repo().load(u.name); } }
export function start(): void { new Service(); }

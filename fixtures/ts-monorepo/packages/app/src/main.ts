import { add } from "@acme/core";
import { sub } from "@acme/core/src/math";
import { ghost } from "@acme/missing";
export const run = (): unknown => [add(1, 2), sub(3, 1), ghost];

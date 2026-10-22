import { parseYamlSubset } from "@repolens/core";

export function parseYamlConfig(text: string): unknown {
  return parseYamlSubset(text);
}

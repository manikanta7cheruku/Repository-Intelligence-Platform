#!/usr/bin/env node
import { runCli } from "./main.js";

const code = await runCli(process.argv.slice(2), {
  out: (s) => process.stdout.write(s),
  err: (s) => process.stderr.write(s),
  cwd: process.cwd(),
  env: process.env,
  isTty: process.stderr.isTTY === true,
});
process.exitCode = code;

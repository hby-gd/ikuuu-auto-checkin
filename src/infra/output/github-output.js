import { appendFileSync } from "node:fs";

export function setGitHubOutput(name, value, source = process.env) {
  if (!source.GITHUB_OUTPUT) {
    return;
  }

  appendFileSync(source.GITHUB_OUTPUT, `${name}<<EOF\n${value}\nEOF\n`);
}

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const CONFLICT_MARKER = /^(?:<{7}(?: |$)|={7}$|>{7}(?: |$))/;

export function scanText(relativePath, content) {
  if (content.includes("\0")) return [];
  const errors = [];
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  lines.forEach((line, index) => {
    const markdownHardBreak = relativePath.endsWith(".md") && /[^ ]  $/.test(line);
    if (/[ \t]+$/.test(line) && !markdownHardBreak) {
      errors.push({ code: "trailing_whitespace", path: relativePath, line: index + 1 });
    }
    if (CONFLICT_MARKER.test(line)) {
      errors.push({ code: "conflict_marker", path: relativePath, line: index + 1 });
    }
  });
  return errors;
}

function repositoryFiles(root) {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root },
  );
  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();
}

export function evaluateRepositoryHygiene(root) {
  const files = repositoryFiles(root);
  const errors = [];
  let textFiles = 0;
  for (const relativePath of files) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) continue;
    const content = fs.readFileSync(absolutePath);
    if (content.includes(0)) continue;
    textFiles += 1;
    errors.push(...scanText(relativePath, content.toString("utf8")));
  }
  return { ok: errors.length === 0, files: files.length, textFiles, errors };
}

export function runRepositoryHygiene(root = DEFAULT_ROOT, logger = console) {
  const result = evaluateRepositoryHygiene(root);
  for (const error of result.errors) {
    logger.error(
      `quality_hygiene_error code=${JSON.stringify(error.code)}` +
        ` path=${JSON.stringify(error.path)} line=${error.line}`,
    );
  }
  logger.log(
    `quality_hygiene_summary status=${result.ok ? "pass" : "fail"}` +
      ` files=${result.files} text_files=${result.textFiles} errors=${result.errors.length}`,
  );
  return result.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runRepositoryHygiene();
}

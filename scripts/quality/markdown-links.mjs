import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-ssr",
  "target",
  "coverage",
  ".turbo",
  ".venv",
  ".pytest_cache",
  ".ruff_cache",
  "data",
]);

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function walkMarkdown(root) {
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) walk(path.join(directory, entry.name));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(path.join(directory, entry.name));
      }
    }
  }
  walk(root);
  return files.sort();
}

function localTargets(markdown) {
  const targets = [];
  let inFence = false;
  for (const line of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const withoutInlineCode = line.replace(/`[^`]*`/g, "");
    const inline = /!?\[[^\]]*\]\(([^)]+)\)/g;
    let match;
    while ((match = inline.exec(withoutInlineCode))) targets.push(match[1]);
    const reference = /^\s*\[[^\]]+\]:\s*(\S+)/.exec(withoutInlineCode);
    if (reference) targets.push(reference[1]);
  }
  return targets;
}

function cleanTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
  target = target.split(/\s+["']/)[0];
  if (
    target === "" ||
    target.startsWith("#") ||
    target.startsWith("/") ||
    /^[a-z][a-z+.-]*:/i.test(target)
  ) {
    return null;
  }
  target = target.split("#")[0].split("?")[0];
  if (target === "") return null;
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

export function evaluateMarkdownLinks(root) {
  const errors = [];
  let links = 0;
  const files = walkMarkdown(root);
  for (const filePath of files) {
    const relativeSource = normalizePath(path.relative(root, filePath));
    for (const rawTarget of localTargets(fs.readFileSync(filePath, "utf8"))) {
      const target = cleanTarget(rawTarget);
      if (!target) continue;
      links += 1;
      const absoluteTarget = path.resolve(path.dirname(filePath), target);
      if (!fs.existsSync(absoluteTarget)) {
        errors.push({
          code: "missing_local_target",
          source: relativeSource,
          target,
        });
      }
    }
  }
  return { ok: errors.length === 0, files: files.length, links, errors };
}

function field(key, value) {
  return value === undefined ? "" : ` ${key}=${JSON.stringify(value)}`;
}

export function printMarkdownLinks(result, logger = console) {
  for (const error of result.errors) {
    logger.error(
      `quality_markdown_error${field("code", error.code)}${field("source", error.source)}` +
        `${field("target", error.target)}`,
    );
  }
  logger.log(
    `quality_markdown_summary status=${result.ok ? "pass" : "fail"}` +
      ` files=${result.files} links=${result.links} errors=${result.errors.length}`,
  );
}

export function runMarkdownLinks(argv = process.argv.slice(2), logger = console) {
  try {
    if (argv.length > 2 || (argv.length === 2 && argv[0] !== "--root")) {
      throw new Error("Usage: markdown-links.mjs [--root PATH]");
    }
    const root = argv.length === 2 ? path.resolve(argv[1]) : DEFAULT_ROOT;
    const result = evaluateMarkdownLinks(root);
    printMarkdownLinks(result, logger);
    return result.ok ? 0 : 1;
  } catch (error) {
    logger.error(
      `quality_markdown_error code="execution" detail=${JSON.stringify(error.message)}`,
    );
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runMarkdownLinks();
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_CONFIG = path.join(SCRIPT_DIR, "quality.config.json");

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function tokenizeRust(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "/" && next === "/") {
      index = source.indexOf("\n", index + 2);
      if (index === -1) break;
      continue;
    }
    if (char === "/" && next === "*") {
      let depth = 1;
      index += 2;
      while (index < source.length && depth > 0) {
        if (source[index] === "/" && source[index + 1] === "*") {
          depth += 1;
          index += 2;
        } else if (source[index] === "*" && source[index + 1] === "/") {
          depth -= 1;
          index += 2;
        } else index += 1;
      }
      continue;
    }
    if (char === '"') {
      index += 1;
      let escaped = false;
      while (index < source.length) {
        if (escaped) escaped = false;
        else if (source[index] === "\\") escaped = true;
        else if (source[index] === '"') {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1;
      while (/[A-Za-z0-9_]/.test(source[end] ?? "")) end += 1;
      tokens.push(source.slice(index, end));
      index = end;
      continue;
    }
    if (char === ":" && next === ":") {
      tokens.push("::");
      index += 2;
      continue;
    }
    tokens.push(char);
    index += 1;
  }
  return tokens;
}

function moduleSegments(relativeWithinRoot) {
  const parts = normalizePath(relativeWithinRoot).split("/");
  const file = parts.pop();
  if (file === "lib.rs" || file === "main.rs" || file === "mod.rs") return parts;
  return [...parts, file.replace(/\.rs$/, "")];
}

function resolveLayer(base, segment, layerNames) {
  const resolved = [...base, segment];
  return layerNames.has(resolved[0]) ? resolved[0] : null;
}

function referencedLayers(tokens, sourceModules, layerNames) {
  const layers = new Set();
  const errors = [];
  for (let index = 0; index < tokens.length - 2; index += 1) {
    if (!["crate", "self", "super"].includes(tokens[index])) continue;
    let cursor = index;
    let base;
    if (tokens[cursor] === "crate" && tokens[cursor + 1] === "::") {
      base = [];
      cursor += 2;
    } else if (tokens[cursor] === "self" && tokens[cursor + 1] === "::") {
      base = [...sourceModules];
      cursor += 2;
    } else {
      base = [...sourceModules];
      while (tokens[cursor] === "super" && tokens[cursor + 1] === "::") {
        if (base.length === 0) {
          errors.push("rust_ambiguous_relative_path");
        } else {
          base.pop();
        }
        cursor += 2;
      }
      if (cursor === index) continue;
    }

    if (tokens[cursor] === "{") {
      let depth = 1;
      for (let group = cursor + 1; group < tokens.length && depth > 0; group += 1) {
        if (tokens[group] === "{") depth += 1;
        else if (tokens[group] === "}") depth -= 1;
        else if (depth === 1 && /^[A-Za-z_]\w*$/.test(tokens[group])) {
          const layer = resolveLayer(base, tokens[group], layerNames);
          if (layer) layers.add(layer);
        }
        if (depth === 0) {
          index = group;
          break;
        }
      }
    } else if (/^[A-Za-z_]\w*$/.test(tokens[cursor] ?? "")) {
      const layer = resolveLayer(base, tokens[cursor], layerNames);
      if (layer) layers.add(layer);
      index = cursor;
    }
  }
  return { layers: [...layers].sort(), errors };
}


function walkRustFiles(directory) {
  const files = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name.endsWith(".rs")) files.push(child);
    }
  }
  if (fs.existsSync(directory)) walk(directory);
  return files.sort();
}

export function evaluateRustBoundaries({ root, config }) {
  const boundary = config.rustBoundaries;
  const layerNames = new Set(boundary.layers);
  const errors = [];
  let activeFiles = 0;
  let references = 0;

  for (const configuredRoot of boundary.roots) {
    const absoluteRoot = path.join(root, configuredRoot);
    for (const file of walkRustFiles(absoluteRoot)) {
      const relativeWithinRoot = normalizePath(path.relative(absoluteRoot, file));
      const sourceLayer = relativeWithinRoot.split("/")[0];
      if (!layerNames.has(sourceLayer)) continue;
      activeFiles += 1;
      const referencesResult = referencedLayers(
        tokenizeRust(fs.readFileSync(file, "utf8")),
        moduleSegments(relativeWithinRoot),
        layerNames,
      );
      references += referencesResult.layers.length;
      for (const code of referencesResult.errors) {
        errors.push({
          code,
          source: normalizePath(path.relative(root, file)),
          detail: sourceLayer,
        });
      }
      const allowed = new Set(boundary.allowedDependencies[sourceLayer] ?? []);
      for (const targetLayer of referencesResult.layers) {
        if (!allowed.has(targetLayer)) {
          errors.push({
            code: "rust_forbidden_direction",
            source: normalizePath(path.relative(root, file)),
            detail: `${sourceLayer}->${targetLayer}`,
          });
        }
      }
    }
  }
  errors.sort((left, right) => `${left.source}:${left.detail}`.localeCompare(`${right.source}:${right.detail}`));
  return {
    ok: errors.length === 0,
    activeFiles,
    references,
    notApplicable: activeFiles === 0,
    errors,
  };
}

function field(key, value) {
  return value === undefined ? "" : ` ${key}=${JSON.stringify(value)}`;
}

export function runRustBoundaries(argv = process.argv.slice(2), logger = console) {
  let root = DEFAULT_ROOT;
  let configPath = DEFAULT_CONFIG;
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index + 1]) throw new Error(`Missing value for ${argv[index]}`);
    if (argv[index] === "--root") root = path.resolve(argv[index + 1]);
    else if (argv[index] === "--config") configPath = path.resolve(argv[index + 1]);
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const result = evaluateRustBoundaries({ root, config });
  for (const error of result.errors) {
    logger.error(
      `quality_rust_boundary_error${field("code", error.code)}` +
        `${field("source", error.source)}${field("detail", error.detail)}`,
    );
  }
  logger.log(
    `quality_rust_boundary_summary status=${result.ok ? "pass" : "fail"}` +
      ` active_files=${result.activeFiles} references=${result.references}` +
      ` not_applicable=${result.notApplicable} errors=${result.errors.length}`,
  );
  return result.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runRustBoundaries();
}

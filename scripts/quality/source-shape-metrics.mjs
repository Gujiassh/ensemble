import fs from "node:fs";
import path from "node:path";

export function normalizePath(value) {
  return value.split(path.sep).join("/");
}

export function countPhysicalLines(text) {
  if (text.length === 0) return 0;
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.length;
}

export function countCodeLines(text, role = "typescript-logic") {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();

  const isPython = role === "python-module" || role === "python-test";
  let inBlockComment = false;
  let inTemplate = false;
  let pythonTripleQuote = null;
  let count = 0;

  for (const line of lines) {
    let hasCode = inTemplate || pythonTripleQuote !== null;
    let quote = inTemplate ? "`" : null;
    let escaped = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];

      if (pythonTripleQuote) {
        const closingIndex = line.indexOf(pythonTripleQuote, index);
        if (closingIndex === -1) break;
        pythonTripleQuote = null;
        index = closingIndex + 2;
        continue;
      }

      if (inBlockComment) {
        if (char === "*" && next === "/") {
          inBlockComment = false;
          index += 1;
        }
        continue;
      }

      if (quote) {
        hasCode = true;
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === quote) {
          if (quote === "`") inTemplate = false;
          quote = null;
        }
        continue;
      }

      if (isPython && char === "#") break;
      if (!isPython && char === "/" && next === "/") break;
      if (!isPython && char === "/" && next === "*") {
        inBlockComment = true;
        index += 1;
        continue;
      }
      if (
        isPython &&
        ((char === '"' && line.slice(index, index + 3) === '\"\"\"') ||
          (char === "'" && line.slice(index, index + 3) === "'''"))
      ) {
        hasCode = true;
        const tripleQuote = line.slice(index, index + 3);
        const closingIndex = line.indexOf(tripleQuote, index + 3);
        if (closingIndex === -1) {
          pythonTripleQuote = tripleQuote;
          break;
        }
        index = closingIndex + 2;
        continue;
      }
      if (char === "\"" || char === "'" || (!isPython && char === "`")) {
        hasCode = true;
        quote = char;
        if (char === "`") inTemplate = true;
        continue;
      }
      if (!/\s/.test(char)) hasCode = true;
    }

    if (hasCode) count += 1;
    if (quote !== "`") inTemplate = false;
  }

  return count;
}

export function walkSourceFiles(root, config) {
  const files = [];
  const excluded = new Set(config.excludedDirectories);
  const extensions = new Set(config.extensions);

  function walk(absoluteDirectory) {
    for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!excluded.has(entry.name)) walk(path.join(absoluteDirectory, entry.name));
      } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
        files.push(path.join(absoluteDirectory, entry.name));
      }
    }
  }

  for (const sourceRoot of config.sourceRoots) {
    const absoluteRoot = path.join(root, sourceRoot);
    if (fs.existsSync(absoluteRoot)) walk(absoluteRoot);
  }
  return files.sort();
}

function hasGeneratedDirective(sourceText, extension, headerLines) {
  const lines = sourceText.replace(/\r\n?/g, "\n").split("\n").slice(0, headerLines);
  const slashLanguage = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".rs"]);
  const directive = slashLanguage.has(extension)
    ? /^\s*\/\/ @generated\s*$/
    : extension === ".py"
      ? /^\s*# @generated\s*$/
      : extension === ".css"
        ? /^\s*\/\* @generated \*\/\s*$/
        : null;
  const canonical = slashLanguage.has(extension)
    ? /^\s*\/\/ Code generated .+ DO NOT EDIT\.\s*$/
    : extension === ".py"
      ? /^\s*# Code generated .+ DO NOT EDIT\.\s*$/
      : extension === ".css"
        ? /^\s*\/\* Code generated .+ DO NOT EDIT\. \*\/\s*$/
        : null;
  return lines.some((line) => directive?.test(line) || canonical?.test(line));
}

export function classifySource(relativePath, config, sourceText = "") {
  const normalized = normalizePath(relativePath);
  const segments = normalized.split("/");
  const baseName = segments.at(-1);
  const extension = path.extname(baseName);

  if (config.trustedGeneratedPaths.includes(normalized)) {
    return { role: "generated", ignored: true, provenance: "trusted-exact-path" };
  }
  const generatedCandidate =
    config.generatedDirectoryNames.some((name) => segments.includes(name)) ||
    config.generatedFileNames.includes(baseName) ||
    config.generatedNameFragments.some((fragment) => baseName.includes(fragment));
  if (
    generatedCandidate &&
    hasGeneratedDirective(sourceText, extension, config.generatedHeaderLines)
  ) {
    return { role: "generated", ignored: true, provenance: "recognized-directive" };
  }
  if (extension === ".py") {
    const isTest =
      config.testDirectoryNames.some((name) => segments.includes(name)) ||
      baseName.startsWith("test_");
    return { role: isTest ? "python-test" : "python-module", ignored: false };
  }
  if (
    config.testDirectoryNames.some((name) => segments.includes(name)) ||
    /\.(?:test|spec)\.[^.]+$/.test(baseName) ||
    /(?:Preview|Stories)\.[^.]+$/.test(baseName)
  ) {
    return { role: "test-preview", ignored: false };
  }
  if (config.declarativePaths.includes(normalized)) {
    return { role: "declarative-data", ignored: false };
  }
  if (config.localizationDirectoryNames.some((name) => segments.includes(name))) {
    return { role: "localization", ignored: false };
  }
  if (extension === ".css") return { role: "stylesheet", ignored: false };
  if (extension === ".rs") return { role: "rust-module", ignored: false };
  if (
    /(?:^|\/)use[A-Z][^/]*\.(?:ts|tsx)$/.test(normalized) ||
    segments.includes("hooks")
  ) {
    return { role: "react-hook", ignored: false };
  }
  if (extension === ".tsx" || extension === ".jsx") {
    return { role: "react-component", ignored: false };
  }
  return { role: "typescript-logic", ignored: false };
}

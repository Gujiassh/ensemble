import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "../..");
const requireFromCanvas = createRequire(
  path.join(REPOSITORY_ROOT, "apps/canvas/package.json"),
);
const ts = requireFromCanvas("typescript");

export function normalizePath(value) {
  return value.split(path.sep).join("/");
}

export function walkImportSources(root, config) {
  const files = [];
  const excluded = new Set(config.excludedDirectories);
  const extensions = new Set(config.extensions);

  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!excluded.has(entry.name)) walk(path.join(directory, entry.name));
      } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
        files.push(path.resolve(directory, entry.name));
      }
    }
  }

  for (const sourceRoot of config.sourceRoots) {
    const absoluteRoot = path.resolve(root, sourceRoot);
    if (fs.existsSync(absoluteRoot)) walk(absoluteRoot);
  }
  return files.sort();
}

function scriptKind(filePath) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

export function parseModuleSpecifiers(filePath, sourceText) {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(filePath),
  );
  const specifiers = new Set();
  const importErrors = [];

  function add(node) {
    if (node && ts.isStringLiteralLike(node)) specifiers.add(node.text);
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      add(node.moduleSpecifier);
    } else if (ts.isImportTypeNode(node)) {
      if (ts.isLiteralTypeNode(node.argument)) add(node.argument.literal);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire =
        ts.isIdentifier(node.expression) && node.expression.text === "require";
      const isImportMetaGlob =
        ts.isPropertyAccessExpression(node.expression) &&
        ["glob", "globEager"].includes(node.expression.name.text) &&
        ts.isMetaProperty(node.expression.expression) &&
        node.expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword;
      if (isDynamicImport) {
        if (node.arguments.length >= 1 && ts.isStringLiteralLike(node.arguments[0])) {
          add(node.arguments[0]);
        } else {
          importErrors.push({ code: "nonliteral_dynamic_import", start: node.getStart() });
        }
      } else if (isImportMetaGlob) {
        const literal = node.arguments.length >= 1 && ts.isStringLiteralLike(node.arguments[0]);
        importErrors.push({
          code: literal ? "unsupported_import_meta_glob" : "nonliteral_import_meta_glob",
          start: node.getStart(),
        });
      } else if (isRequire && node.arguments.length === 1) {
        add(node.arguments[0]);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  return {
    specifiers: [...specifiers].sort(),
    importErrors,
    parseErrors: (sourceFile.parseDiagnostics ?? []).map((diagnostic) => ({
      code: diagnostic.code,
      start: diagnostic.start ?? 0,
    })),
  };
}

function resolveCandidate(candidate, extensions) {
  const candidates = [candidate];
  if (!path.extname(candidate)) {
    for (const extension of extensions) candidates.push(`${candidate}${extension}`);
    for (const extension of extensions) {
      candidates.push(path.join(candidate, `index${extension}`));
    }
  }
  return candidates.find((value) => fs.existsSync(value) && fs.statSync(value).isFile());
}

export function resolveLocalImport(root, sourcePath, specifier, config) {
  const specifierExtension = path.extname(specifier);
  if (
    specifierExtension &&
    !config.extensions.includes(specifierExtension) &&
    config.ignoredAssetExtensions.includes(specifierExtension)
  ) {
    return { kind: "asset" };
  }

  let candidate;
  if (specifier.startsWith(".")) {
    candidate = path.resolve(path.dirname(sourcePath), specifier);
  } else {
    const configuredPrefixes = [
      ...Object.entries(config.aliases),
      ...Object.entries(config.baseUrlAliases),
    ].sort(([left], [right]) => right.length - left.length);
    const match = configuredPrefixes.find(
      ([alias]) => specifier === alias || specifier.startsWith(`${alias}/`),
    );
    if (!match) return { kind: "external" };
    const [alias, configuredTarget] = match;
    const suffix = specifier.slice(alias.length).replace(/^\//, "");
    const aliasTarget = path.resolve(root, configuredTarget);
    candidate = suffix
      ? path.resolve(path.extname(aliasTarget) ? path.dirname(aliasTarget) : aliasTarget, suffix)
      : aliasTarget;
  }

  const resolved = resolveCandidate(candidate, config.extensions);
  if (resolved) return { kind: "local", path: path.resolve(resolved) };
  return { kind: "unresolved-local" };
}

export function findImportCycles(graph) {
  let index = 0;
  const indices = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];

  function connect(node) {
    indices.set(node, index);
    lowLinks.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const target of [...(graph.get(node) ?? [])].sort()) {
      if (!graph.has(target)) continue;
      if (!indices.has(target)) {
        connect(target);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(target)));
      } else if (onStack.has(target)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indices.get(target)));
      }
    }

    if (lowLinks.get(node) !== indices.get(node)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);

    if (
      component.length > 1 ||
      (component.length === 1 && graph.get(component[0])?.has(component[0]))
    ) {
      cycles.push(component.sort());
    }
  }

  for (const node of [...graph.keys()].sort()) {
    if (!indices.has(node)) connect(node);
  }
  return cycles;
}

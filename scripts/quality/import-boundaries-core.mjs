import fs from "node:fs";
import path from "node:path";

import {
  findImportCycles,
  normalizePath,
  parseModuleSpecifiers,
  resolveLocalImport,
  walkImportSources,
} from "./typescript-import-graph.mjs";

function isWithin(relativePath, rootPath) {
  return relativePath === rootPath || relativePath.startsWith(`${rootPath}/`);
}

function validReviewDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function validateConfig(config) {
  if (config?.version !== 1 || !config.boundaries) return ["config_version"];
  const boundary = config.boundaries;
  const requiredArrays = [
    "sourceRoots",
    "extensions",
    "ignoredAssetExtensions",
    "excludedDirectories",
    "applicationRoots",
    "testDirectoryNames",
    "testNameFragments",
    "businessFeatureNames",
    "featureDirectoryNames",
    "publicEntryNames",
  ];
  const errors = requiredArrays
    .filter((key) => !Array.isArray(boundary[key]))
    .map((key) => `config_field:${key}`);
  for (const key of ["aliases", "baseUrlAliases"]) {
    if (!boundary[key] || typeof boundary[key] !== "object") {
      errors.push(`config_field:${key}`);
    }
  }
  if (!Number.isInteger(boundary.maxDebtReviewDays) || boundary.maxDebtReviewDays < 1) {
    errors.push("config_field:maxDebtReviewDays");
  }
  for (const key of ["protocolRoot", "designSystemRoot", "featureRoot"]) {
    if (typeof boundary[key] !== "string" || boundary[key].length === 0) {
      errors.push(`config_field:${key}`);
    }
  }
  return errors;
}

function isTestPath(relativePath, config) {
  const segments = relativePath.split("/");
  const baseName = segments.at(-1);
  return (
    config.testDirectoryNames.some((name) => segments.includes(name)) ||
    config.testNameFragments.some((fragment) => baseName.includes(fragment))
  );
}

function featureName(relativePath, config) {
  if (!isWithin(relativePath, config.featureRoot)) return null;
  const remainder = relativePath.slice(config.featureRoot.length).replace(/^\//, "");
  const name = remainder.split("/")[0];
  return config.featureDirectoryNames.includes(name) ? name : null;
}

function publicEntries(root, feature, config) {
  return config.publicEntryNames
    .map((entry) => path.resolve(root, config.featureRoot, feature, entry))
    .filter((entry) => fs.existsSync(entry));
}

function debtKey(source, target) {
  return `${source}->${target}`;
}

function validateDebtManifest(manifest, root, config, candidates, today) {
  if (
    manifest?.version !== 1 ||
    !Array.isArray(manifest.edges) ||
    Object.keys(manifest).sort().join("|") !== "edges|version"
  ) {
    return { errors: [{ code: "architecture_debt_manifest_schema" }], allowed: new Set() };
  }

  const expectedKeys = [
    "source",
    "target",
    "owner",
    "reason",
    "publicEntryPlan",
    "reviewBy",
  ].sort();
  const errors = [];
  const allowed = new Set();
  const seen = new Set();
  const todayDate = new Date(`${today}T00:00:00Z`);

  manifest.edges.forEach((record, index) => {
    const detail = `edge_${index}`;
    if (Object.keys(record ?? {}).sort().join("|") !== expectedKeys.join("|")) {
      errors.push({ code: "architecture_debt_schema", detail });
      return;
    }
    const key = debtKey(record.source, record.target);
    if (seen.has(key)) {
      errors.push({ code: "architecture_debt_duplicate", source: record.source, target: record.target });
      return;
    }
    seen.add(key);
    if (
      path.isAbsolute(record.source) ||
      path.isAbsolute(record.target) ||
      normalizePath(record.source) !== record.source ||
      normalizePath(record.target) !== record.target ||
      record.source.split("/").includes("..") ||
      record.target.split("/").includes("..")
    ) {
      errors.push({ code: "architecture_debt_path", source: record.source, target: record.target });
      return;
    }
    for (const field of ["owner", "reason", "publicEntryPlan"]) {
      if (typeof record[field] !== "string" || record[field].trim().length < 20) {
        errors.push({ code: "architecture_debt_schema", detail: `${detail}:${field}` });
        return;
      }
    }
    const reviewDate = validReviewDate(record.reviewBy);
    if (!reviewDate) {
      errors.push({ code: "architecture_debt_schema", detail: `${detail}:reviewBy` });
      return;
    }
    const reviewDays = (reviewDate.valueOf() - todayDate.valueOf()) / 86_400_000;
    if (reviewDays < 0) {
      errors.push({ code: "architecture_debt_expired", source: record.source, target: record.target });
      return;
    }
    if (reviewDays > config.maxDebtReviewDays) {
      errors.push({ code: "architecture_debt_review_too_distant", source: record.source, target: record.target });
      return;
    }
    if (!fs.existsSync(path.join(root, record.source)) || !fs.existsSync(path.join(root, record.target))) {
      errors.push({ code: "architecture_debt_missing_file", source: record.source, target: record.target });
      return;
    }
    if (!candidates.has(key)) {
      errors.push({ code: "architecture_debt_stale", source: record.source, target: record.target });
      return;
    }
    allowed.add(key);
  });
  return { errors, allowed };
}

function edgeBoundaryResult(root, sourceRelative, targetPath, config) {
  const targetRelative = normalizePath(path.relative(root, targetPath));
  const errors = [];
  let debtCandidate = null;
  if (!isTestPath(sourceRelative, config) && isTestPath(targetRelative, config)) {
    errors.push({
      code: "production_imports_test_support",
      source: sourceRelative,
      target: targetRelative,
    });
  }
  if (
    isWithin(sourceRelative, config.protocolRoot) &&
    config.applicationRoots.some((appRoot) => isWithin(targetRelative, appRoot))
  ) {
    errors.push({
      code: "protocol_imports_application",
      source: sourceRelative,
      target: targetRelative,
    });
  }
  if (isWithin(sourceRelative, config.designSystemRoot)) {
    const targetFeature = featureName(targetRelative, config);
    if (targetFeature && config.businessFeatureNames.includes(targetFeature)) {
      errors.push({
        code: "design_system_imports_business_feature",
        source: sourceRelative,
        target: targetRelative,
      });
    }
  }

  const sourceFeature = featureName(sourceRelative, config);
  const targetFeature = featureName(targetRelative, config);
  if (sourceFeature && targetFeature && sourceFeature !== targetFeature) {
    const entries = publicEntries(root, targetFeature, config);
    if (entries.length > 0) {
      if (!entries.includes(targetPath)) {
        errors.push({
          code: "cross_feature_private_import",
          source: sourceRelative,
          target: targetRelative,
        });
      }
    } else {
      debtCandidate = { source: sourceRelative, target: targetRelative };
    }
  }
  return { errors, debtCandidate };
}

export function evaluateImportBoundaries({
  root,
  config,
  debtManifest = { version: 1, edges: [] },
  today = new Date().toISOString().slice(0, 10),
}) {
  const configErrors = validateConfig(config);
  if (configErrors.length > 0) {
    return {
      ok: false,
      files: 0,
      edges: 0,
      allowedDebtEdges: 0,
      errors: configErrors.map((code) => ({ code })),
    };
  }

  const boundary = config.boundaries;
  const absoluteFiles = walkImportSources(root, boundary);
  const graph = new Map(absoluteFiles.map((file) => [file, new Set()]));
  const errors = [];
  const debtCandidates = new Map();
  let edgeCount = 0;

  for (const sourcePath of absoluteFiles) {
    const sourceRelative = normalizePath(path.relative(root, sourcePath));
    const parsed = parseModuleSpecifiers(sourcePath, fs.readFileSync(sourcePath, "utf8"));
    for (const diagnostic of parsed.parseErrors) {
      errors.push({
        code: "parse_error",
        source: sourceRelative,
        detail: `${diagnostic.code}:${diagnostic.start}`,
      });
    }
    for (const importError of parsed.importErrors) {
      errors.push({
        code: importError.code,
        source: sourceRelative,
        detail: String(importError.start),
      });
    }

    for (const specifier of parsed.specifiers) {
      const resolution = resolveLocalImport(root, sourcePath, specifier, boundary);
      if (resolution.kind === "external" || resolution.kind === "asset") continue;
      if (resolution.kind === "unresolved-local") {
        errors.push({ code: "unresolved_local_import", source: sourceRelative, specifier });
        continue;
      }

      graph.get(sourcePath).add(resolution.path);
      edgeCount += 1;
      const result = edgeBoundaryResult(root, sourceRelative, resolution.path, boundary);
      errors.push(...result.errors);
      if (result.debtCandidate) {
        debtCandidates.set(
          debtKey(result.debtCandidate.source, result.debtCandidate.target),
          result.debtCandidate,
        );
      }
    }
  }

  const debt = validateDebtManifest(debtManifest, root, boundary, debtCandidates, today);
  errors.push(...debt.errors);
  for (const [key, candidate] of debtCandidates) {
    if (!debt.allowed.has(key)) {
      errors.push({ code: "cross_feature_private_import", ...candidate });
    }
  }

  for (const component of findImportCycles(graph)) {
    errors.push({
      code: "circular_local_import",
      cycle: component.map((file) => normalizePath(path.relative(root, file))).join("->"),
    });
  }

  errors.sort((left, right) =>
    `${left.code}:${left.source ?? ""}:${left.target ?? ""}:${left.cycle ?? ""}`.localeCompare(
      `${right.code}:${right.source ?? ""}:${right.target ?? ""}:${right.cycle ?? ""}`,
    ),
  );
  return {
    ok: errors.length === 0,
    files: absoluteFiles.length,
    edges: edgeCount,
    allowedDebtEdges: debt.allowed.size,
    errors,
  };
}

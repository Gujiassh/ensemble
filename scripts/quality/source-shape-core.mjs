import fs from "node:fs";
import path from "node:path";

import {
  classifySource,
  countCodeLines,
  countPhysicalLines,
  normalizePath,
  walkSourceFiles,
} from "./source-shape-metrics.mjs";
import {
  validateExceptions,
  validateSoftReviews,
} from "./source-shape-reviews.mjs";

function validateConfig(config) {
  const errors = [];
  if (config?.version !== 1) errors.push("config_version");
  if (!config?.shape || typeof config.shape !== "object") {
    errors.push("config_shape");
    return errors;
  }
  const requiredArrays = [
    "sourceRoots",
    "excludedDirectories",
    "extensions",
    "generatedDirectoryNames",
    "generatedFileNames",
    "generatedNameFragments",
    "trustedGeneratedPaths",
    "declarativePaths",
    "localizationDirectoryNames",
    "testDirectoryNames",
  ];
  for (const key of requiredArrays) {
    if (!Array.isArray(config.shape[key])) errors.push(`config_field:${key}`);
  }
  for (const key of [
    "maxExceptionReviewDays",
    "maxSoftReviewDays",
    "generatedHeaderLines",
    "generatedDirectiveVersion",
  ]) {
    if (!Number.isInteger(config.shape[key]) || config.shape[key] < 1) {
      errors.push(`config_field:${key}`);
    }
  }
  if (config.shape.generatedDirectiveVersion !== 1) {
    errors.push("config_field:generatedDirectiveVersion");
  }
  if (
    typeof config.shape.maxExceptionGrowthRatio !== "number" ||
    config.shape.maxExceptionGrowthRatio <= 1 ||
    config.shape.maxExceptionGrowthRatio > 2
  ) {
    errors.push("config_field:maxExceptionGrowthRatio");
  }
  const requiredRoles = [
    "react-component",
    "react-hook",
    "typescript-logic",
    "rust-module",
    "stylesheet",
    "test-preview",
    "localization",
    "declarative-data",
    "python-module",
    "python-test",
  ];
  for (const role of requiredRoles) {
    if (!config.shape.roles?.[role]) errors.push(`config_role_missing:${role}`);
  }
  for (const [role, limits] of Object.entries(config.shape.roles ?? {})) {
    if (
      !Number.isInteger(limits.soft) ||
      !Number.isInteger(limits.review) ||
      limits.soft < 1 ||
      limits.review <= limits.soft
    ) {
      errors.push(`config_role_threshold:${role}`);
    }
  }
  return errors;
}

export function evaluateSourceShape({
  root,
  config,
  manifest,
  reviewsManifest = { version: 1, reviews: [] },
  today,
}) {
  const configErrors = validateConfig(config);
  if (configErrors.length > 0) {
    return {
      ok: false,
      errors: configErrors.map((code) => ({ code })),
      warnings: [],
      files: [],
      ignoredGenerated: 0,
      exceptionsUsed: 0,
      softReviewsUsed: 0,
    };
  }

  const files = [];
  const measurements = new Map();
  let ignoredGenerated = 0;
  for (const absolutePath of walkSourceFiles(root, config.shape)) {
    const relativePath = normalizePath(path.relative(root, absolutePath));
    const text = fs.readFileSync(absolutePath, "utf8");
    const classification = classifySource(relativePath, config.shape, text);
    if (classification.ignored) {
      ignoredGenerated += 1;
      measurements.set(relativePath, { ...classification });
      continue;
    }
    const limits = config.shape.roles[classification.role];
    const measurement = {
      path: relativePath,
      role: classification.role,
      physicalLines: countPhysicalLines(text),
      codeLines: countCodeLines(text, classification.role),
      soft: limits.soft,
      review: limits.review,
      ignored: false,
    };
    files.push(measurement);
    measurements.set(relativePath, measurement);
  }

  const exceptionValidation = validateExceptions(
    manifest,
    root,
    measurements,
    today,
    config.shape,
  );
  const errors = [...exceptionValidation.errors];
  const warnings = [];
  let exceptionsUsed = 0;

  for (const measurement of files) {
    if (measurement.codeLines > measurement.review) {
      if (exceptionValidation.records.has(measurement.path)) exceptionsUsed += 1;
      else errors.push({ code: "review_threshold_exceeded", ...measurement });
    } else if (measurement.codeLines > measurement.soft) {
      warnings.push(measurement);
    }
  }

  const softReviewValidation = validateSoftReviews(
    reviewsManifest,
    root,
    warnings,
    today,
    config.shape,
  );
  errors.push(...softReviewValidation.errors);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    files,
    ignoredGenerated,
    exceptionsUsed,
    softReviewsUsed: softReviewValidation.records.size,
  };
}

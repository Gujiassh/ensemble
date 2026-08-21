import fs from "node:fs";
import path from "node:path";

import { normalizePath } from "./source-shape-metrics.mjs";

function validReviewDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function reviewDateError(reviewBy, today, maxDays, prefix) {
  const reviewDate = validReviewDate(reviewBy);
  if (!reviewDate) return { code: "review_date_schema", detail: prefix };
  const todayDate = new Date(`${today}T00:00:00Z`);
  const reviewDays = (reviewDate.valueOf() - todayDate.valueOf()) / 86_400_000;
  if (reviewDays < 0) return { code: "review_expired", detail: prefix };
  if (reviewDays > maxDays) return { code: "review_too_distant", detail: prefix };
  return null;
}

function validateExceptionRecord(
  record,
  index,
  root,
  measurements,
  today,
  config,
) {
  const prefix = `exception_${index}`;
  const errors = [];
  const keys = [
    "path",
    "role",
    "owner",
    "rationale",
    "cohesion",
    "maxCodeLines",
    "reviewBy",
  ];
  if (Object.keys(record ?? {}).sort().join("|") !== [...keys].sort().join("|")) {
    return [{ code: "exception_schema", detail: prefix }];
  }
  if (
    typeof record.path !== "string" ||
    path.isAbsolute(record.path) ||
    normalizePath(record.path) !== record.path ||
    record.path.split("/").includes("..")
  ) {
    errors.push({ code: "exception_path", detail: prefix });
  }
  for (const key of ["role", "owner"]) {
    if (typeof record[key] !== "string" || record[key].trim().length < 3) {
      errors.push({ code: "exception_schema", detail: `${prefix}:${key}` });
    }
  }
  for (const key of ["rationale", "cohesion"]) {
    if (typeof record[key] !== "string" || record[key].trim().length < 20) {
      errors.push({ code: "exception_schema", detail: `${prefix}:${key}` });
    }
  }
  if (!Number.isInteger(record.maxCodeLines) || record.maxCodeLines < 1) {
    errors.push({ code: "exception_schema", detail: `${prefix}:maxCodeLines` });
  }
  const dateError = reviewDateError(
    record.reviewBy,
    today,
    config.maxExceptionReviewDays,
    `${prefix}:reviewBy`,
  );
  if (dateError) {
    errors.push({
      code:
        dateError.code === "review_expired"
          ? "exception_expired"
          : dateError.code === "review_too_distant"
            ? "exception_review_too_distant"
            : "exception_schema",
      path: record.path,
      detail: dateError.detail,
    });
  }
  if (errors.length > 0) return errors;

  const measurement = measurements.get(record.path);
  if (!fs.existsSync(path.join(root, record.path))) {
    return [{ code: "exception_missing_file", path: record.path }];
  }
  if (!measurement || measurement.ignored) {
    return [{ code: "exception_unscanned_file", path: record.path }];
  }
  if (measurement.role !== record.role) {
    return [{ code: "exception_role_mismatch", path: record.path }];
  }
  if (measurement.codeLines <= measurement.review) {
    return [{ code: "exception_stale", path: record.path }];
  }
  if (record.maxCodeLines <= measurement.review) {
    return [{ code: "exception_invalid_ceiling", path: record.path }];
  }
  if (measurement.codeLines > record.maxCodeLines) {
    return [{ code: "exception_ceiling_exceeded", path: record.path }];
  }
  const proportionalCeiling = Math.ceil(
    Math.max(measurement.codeLines, measurement.review) * config.maxExceptionGrowthRatio,
  );
  if (record.maxCodeLines > proportionalCeiling) {
    return [{
      code: "exception_disproportionate_ceiling",
      path: record.path,
      allowedCeiling: proportionalCeiling,
    }];
  }
  return [];
}

export function validateExceptions(manifest, root, measurements, today, config) {
  if (
    manifest?.version !== 1 ||
    !Array.isArray(manifest.exceptions) ||
    Object.keys(manifest).sort().join("|") !== "exceptions|version"
  ) {
    return { errors: [{ code: "exception_manifest_schema" }], records: new Map() };
  }

  const errors = [];
  const records = new Map();
  manifest.exceptions.forEach((record, index) => {
    if (records.has(record?.path)) {
      errors.push({ code: "exception_duplicate", path: record.path });
      return;
    }
    const recordErrors = validateExceptionRecord(
      record,
      index,
      root,
      measurements,
      today,
      config,
    );
    errors.push(...recordErrors);
    if (recordErrors.length === 0) records.set(record.path, record);
  });
  return { errors, records };
}

export function validateSoftReviews(manifest, root, warnings, today, config) {
  if (
    manifest?.version !== 1 ||
    !Array.isArray(manifest.reviews) ||
    Object.keys(manifest).sort().join("|") !== "reviews|version"
  ) {
    return { errors: [{ code: "soft_review_manifest_schema" }], records: new Map() };
  }
  const expectedKeys = [
    "path",
    "role",
    "owner",
    "responsibility",
    "decision",
    "rationale",
    "trigger",
    "reviewedCodeLines",
    "reviewBy",
  ].sort();
  const validDecisions = new Set([
    "accept-cohesive",
    "split-before-extension",
    "freeze-no-growth",
    "freeze-temporary",
  ]);
  const warningMap = new Map(warnings.map((warning) => [warning.path, warning]));
  const records = new Map();
  const errors = [];

  manifest.reviews.forEach((record, index) => {
    const detail = `soft_review_${index}`;
    if (Object.keys(record ?? {}).sort().join("|") !== expectedKeys.join("|")) {
      errors.push({ code: "soft_review_schema", detail });
      return;
    }
    if (records.has(record.path)) {
      errors.push({ code: "soft_review_duplicate", path: record.path });
      return;
    }
    if (
      typeof record.path !== "string" ||
      path.isAbsolute(record.path) ||
      normalizePath(record.path) !== record.path ||
      record.path.split("/").includes("..")
    ) {
      errors.push({ code: "soft_review_path", detail });
      return;
    }
    for (const field of ["owner", "responsibility", "rationale", "trigger"]) {
      if (typeof record[field] !== "string" || record[field].trim().length < 20) {
        errors.push({ code: "soft_review_schema", detail: `${detail}:${field}` });
        return;
      }
    }
    if (!validDecisions.has(record.decision) || !Number.isInteger(record.reviewedCodeLines)) {
      errors.push({ code: "soft_review_schema", detail });
      return;
    }
    const dateError = reviewDateError(
      record.reviewBy,
      today,
      config.maxSoftReviewDays,
      `${detail}:reviewBy`,
    );
    if (dateError) {
      errors.push({ code: `soft_${dateError.code}`, path: record.path });
      return;
    }
    if (!fs.existsSync(path.join(root, record.path))) {
      errors.push({ code: "soft_review_missing_file", path: record.path });
      return;
    }
    const warning = warningMap.get(record.path);
    if (!warning) {
      errors.push({ code: "soft_review_stale", path: record.path });
      return;
    }
    if (warning.role !== record.role) {
      errors.push({ code: "soft_review_role_mismatch", path: record.path });
      return;
    }
    if (warning.codeLines !== record.reviewedCodeLines) {
      errors.push({
        code: "soft_review_size_changed",
        path: record.path,
        reviewedCodeLines: record.reviewedCodeLines,
        codeLines: warning.codeLines,
      });
      return;
    }
    records.set(record.path, record);
  });

  for (const warning of warnings) {
    if (!records.has(warning.path)) {
      errors.push({ code: "soft_warning_unreviewed", path: warning.path, role: warning.role });
    }
  }
  return { errors, records };
}

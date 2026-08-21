import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_CONFIG = path.join(SCRIPT_DIR, "quality.config.json");
const DEFAULT_DEBT = path.join(SCRIPT_DIR, "formatter-debt.json");

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function formatterFiles(root, config) {
  const extensions = new Set(config.extensions);
  const files = [];
  function add(absolutePath) {
    if (!fs.existsSync(absolutePath)) return;
    const stat = fs.statSync(absolutePath);
    if (stat.isFile() && extensions.has(path.extname(absolutePath))) {
      files.push(normalizePath(path.relative(root, absolutePath)));
    } else if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        add(path.join(absolutePath, entry.name));
      }
    }
  }
  config.roots.forEach((configuredRoot) => add(path.join(root, configuredRoot)));
  return [...new Set(files)].sort();
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function reviewDateError(value, today, maxDays) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return "formatter_debt_date_schema";
  const review = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(review.valueOf()) || review.toISOString().slice(0, 10) !== value) {
    return "formatter_debt_date_schema";
  }
  const days = (review.valueOf() - new Date(`${today}T00:00:00Z`).valueOf()) / 86_400_000;
  if (days < 0) return "formatter_debt_expired";
  if (days > maxDays) return "formatter_debt_review_too_distant";
  return null;
}

export function validateFormatterDebt({ root, config, manifest, differing, today }) {
  if (
    manifest?.version !== 1 ||
    !Array.isArray(manifest.files) ||
    Object.keys(manifest).sort().join("|") !== "files|version"
  ) {
    return { errors: [{ code: "formatter_debt_manifest_schema" }], allowed: new Set() };
  }
  const expected = ["path", "owner", "reason", "contentSha256", "reviewBy"].sort();
  const errors = [];
  const allowed = new Set();
  for (const [index, record] of manifest.files.entries()) {
    if (Object.keys(record ?? {}).sort().join("|") !== expected.join("|")) {
      errors.push({ code: "formatter_debt_schema", detail: `file_${index}` });
      continue;
    }
    if (allowed.has(record.path)) {
      errors.push({ code: "formatter_debt_duplicate", path: record.path });
      continue;
    }
    if (
      path.isAbsolute(record.path) ||
      normalizePath(record.path) !== record.path ||
      record.path.split("/").includes("..") ||
      typeof record.owner !== "string" ||
      record.owner.length < 20 ||
      typeof record.reason !== "string" ||
      record.reason.length < 20 ||
      !/^[a-f0-9]{64}$/.test(record.contentSha256)
    ) {
      errors.push({ code: "formatter_debt_schema", path: record.path });
      continue;
    }
    const dateError = reviewDateError(record.reviewBy, today, config.maxDebtReviewDays);
    if (dateError) {
      errors.push({ code: dateError, path: record.path });
      continue;
    }
    const absolutePath = path.join(root, record.path);
    if (!fs.existsSync(absolutePath)) {
      errors.push({ code: "formatter_debt_missing_file", path: record.path });
      continue;
    }
    if (sha256(absolutePath) !== record.contentSha256) {
      errors.push({ code: "formatter_debt_content_changed", path: record.path });
      continue;
    }
    if (!differing.has(record.path)) {
      errors.push({ code: "formatter_debt_stale", path: record.path });
      continue;
    }
    allowed.add(record.path);
  }
  for (const file of differing) {
    if (!allowed.has(file)) errors.push({ code: "frontend_format_required", path: file });
  }
  return { errors, allowed };
}

export function runFrontendFormat(root = DEFAULT_ROOT, logger = console) {
  const allConfig = JSON.parse(fs.readFileSync(DEFAULT_CONFIG, "utf8"));
  const manifest = JSON.parse(fs.readFileSync(DEFAULT_DEBT, "utf8"));
  const files = formatterFiles(root, allConfig.formatter);
  const executable = path.join(root, "node_modules/.bin/prettier");
  const result = spawnSync(executable, ["--list-different", ...files], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.error || ![0, 1].includes(result.status)) {
    logger.error(`quality_format_error code="prettier_execution" detail=${JSON.stringify(result.stderr)}`);
    return 1;
  }
  const differing = new Set(
    result.stdout
      .split(/\r?\n/)
      .map((value) => normalizePath(value.trim()))
      .filter(Boolean),
  );
  const validation = validateFormatterDebt({
    root,
    config: allConfig.formatter,
    manifest,
    differing,
    today: new Date().toISOString().slice(0, 10),
  });
  for (const error of validation.errors) {
    logger.error(
      `quality_format_error code=${JSON.stringify(error.code)}` +
        ` path=${JSON.stringify(error.path)} detail=${JSON.stringify(error.detail)}`,
    );
  }
  logger.log(
    `quality_format_summary status=${validation.errors.length === 0 ? "pass" : "fail"}` +
      ` files=${files.length} differing=${differing.size}` +
      ` allowed_debt=${validation.allowed.size} errors=${validation.errors.length}`,
  );
  return validation.errors.length === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runFrontendFormat();
}

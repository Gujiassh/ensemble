import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { evaluateSourceShape } from "./source-shape-core.mjs";

export { evaluateSourceShape } from "./source-shape-core.mjs";
export { countCodeLines } from "./source-shape-metrics.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_CONFIG = path.join(SCRIPT_DIR, "quality.config.json");
const DEFAULT_EXCEPTIONS = path.join(SCRIPT_DIR, "shape-exceptions.json");
const DEFAULT_REVIEWS = path.join(SCRIPT_DIR, "soft-warning-reviews.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function field(key, value) {
  return value === undefined ? "" : ` ${key}=${JSON.stringify(value)}`;
}

export function printSourceShape(result, logger = console) {
  for (const warning of result.warnings) {
    logger.warn(
      `quality_shape_warning${field("path", warning.path)}${field("role", warning.role)}` +
        `${field("physical_lines", warning.physicalLines)}${field("code_lines", warning.codeLines)}` +
        `${field("soft", warning.soft)}${field("review", warning.review)}`,
    );
  }
  for (const error of result.errors) {
    logger.error(
      `quality_shape_error${field("code", error.code)}${field("path", error.path)}` +
        `${field("role", error.role)}${field("code_lines", error.codeLines)}` +
        `${field("review", error.review)}${field("detail", error.detail)}`,
    );
  }
  logger.log(
    `quality_shape_summary status=${result.ok ? "pass" : "fail"}` +
      ` files=${result.files.length} warnings=${result.warnings.length}` +
      ` errors=${result.errors.length} ignored_generated=${result.ignoredGenerated}` +
      ` exceptions_used=${result.exceptionsUsed} soft_reviews_used=${result.softReviewsUsed}`,
  );
}

function parseArguments(argv) {
  const result = {
    root: DEFAULT_ROOT,
    configPath: DEFAULT_CONFIG,
    exceptionsPath: DEFAULT_EXCEPTIONS,
    reviewsPath: DEFAULT_REVIEWS,
  };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for ${key}`);
    if (key === "--root") result.root = path.resolve(value);
    else if (key === "--config") result.configPath = path.resolve(value);
    else if (key === "--exceptions") result.exceptionsPath = path.resolve(value);
    else if (key === "--reviews") result.reviewsPath = path.resolve(value);
    else throw new Error(`Unknown argument: ${key}`);
  }
  return result;
}

export function runSourceShape(argv = process.argv.slice(2), logger = console) {
  try {
    const options = parseArguments(argv);
    const result = evaluateSourceShape({
      root: options.root,
      config: readJson(options.configPath),
      manifest: readJson(options.exceptionsPath),
      reviewsManifest: readJson(options.reviewsPath),
      today: new Date().toISOString().slice(0, 10),
    });
    printSourceShape(result, logger);
    return result.ok ? 0 : 1;
  } catch (error) {
    logger.error(`quality_shape_error code="execution" detail=${JSON.stringify(error.message)}`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runSourceShape();
}

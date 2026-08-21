import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { evaluateImportBoundaries } from "./import-boundaries-core.mjs";

export { evaluateImportBoundaries } from "./import-boundaries-core.mjs";
export { parseModuleSpecifiers } from "./typescript-import-graph.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_CONFIG = path.join(SCRIPT_DIR, "quality.config.json");
const DEFAULT_DEBT = path.join(SCRIPT_DIR, "architecture-debt.json");

function field(key, value) {
  return value === undefined ? "" : ` ${key}=${JSON.stringify(value)}`;
}

export function printImportBoundaries(result, logger = console) {
  for (const error of result.errors) {
    logger.error(
      `quality_boundary_error${field("code", error.code)}${field("source", error.source)}` +
        `${field("target", error.target)}${field("specifier", error.specifier)}` +
        `${field("cycle", error.cycle)}${field("detail", error.detail)}`,
    );
  }
  logger.log(
    `quality_boundary_summary status=${result.ok ? "pass" : "fail"}` +
      ` files=${result.files} edges=${result.edges} allowed_debt_edges=${result.allowedDebtEdges}` +
      ` errors=${result.errors.length}`,
  );
}

function parseArguments(argv) {
  const result = { root: DEFAULT_ROOT, configPath: DEFAULT_CONFIG, debtPath: DEFAULT_DEBT };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for ${key}`);
    if (key === "--root") result.root = path.resolve(value);
    else if (key === "--config") result.configPath = path.resolve(value);
    else if (key === "--debt") result.debtPath = path.resolve(value);
    else throw new Error(`Unknown argument: ${key}`);
  }
  return result;
}

export function runImportBoundaries(argv = process.argv.slice(2), logger = console) {
  try {
    const options = parseArguments(argv);
    const config = JSON.parse(fs.readFileSync(options.configPath, "utf8"));
    const debtManifest = JSON.parse(fs.readFileSync(options.debtPath, "utf8"));
    const result = evaluateImportBoundaries({ root: options.root, config, debtManifest });
    printImportBoundaries(result, logger);
    return result.ok ? 0 : 1;
  } catch (error) {
    logger.error(
      `quality_boundary_error code="execution" detail=${JSON.stringify(error.message)}`,
    );
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runImportBoundaries();
}

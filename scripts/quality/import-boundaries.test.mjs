import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  evaluateImportBoundaries,
  parseModuleSpecifiers,
} from "./import-boundaries.mjs";

const TODAY = "2026-08-21";

function config() {
  return {
    version: 1,
    boundaries: {
      sourceRoots: ["apps/canvas/src", "packages/protocol/src"],
      extensions: [".ts", ".tsx", ".js", ".jsx"],
      ignoredAssetExtensions: [".css", ".svg", ".png"],
      excludedDirectories: ["node_modules", "dist", "target"],
      aliases: { "@ensemble/protocol": "packages/protocol/src/index.ts" },
      baseUrlAliases: { src: "apps/canvas/src" },
      protocolRoot: "packages/protocol/src",
      applicationRoots: ["apps"],
      testDirectoryNames: [
        "test-support",
        "__tests__",
        "tests",
        "fixtures",
        "mocks",
      ],
      testNameFragments: [".test.", ".spec.", ".stories.", "Preview."],
      designSystemRoot: "apps/canvas/src/design-system",
      businessFeatureNames: ["app-shell", "settings", "workspace"],
      featureRoot: "apps/canvas/src",
      featureDirectoryNames: ["app-shell", "settings", "workspace"],
      publicEntryNames: ["index.ts", "index.tsx"],
      maxDebtReviewDays: 180,
    },
  };
}

function emptyDebt() {
  return { version: 1, edges: [] };
}

function debtRecord(source, target, reviewBy = "2026-12-31") {
  return {
    source,
    target,
    owner: "Canvas workspace integration owner",
    reason: "This exact private dependency predates a reviewed feature public entry.",
    publicEntryPlan: "Create the target feature index and migrate this caller before extension.",
    reviewBy,
  };
}

function evaluate(root, debtManifest = emptyDebt()) {
  return evaluateImportBoundaries({
    root,
    config: config(),
    debtManifest,
    today: TODAY,
  });
}

function withTempRoot(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ensemble-boundaries-"));
  try {
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function write(root, relativePath, source) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, source);
}

test("TypeScript parser covers all local import syntaxes and two-argument dynamic import", () => {
  const source = [
    'export { value } from "./value";',
    'import legacy = require("./legacy");',
    'const required = require("./required");',
    'void import("./dynamic", { with: { type: "json" } });',
    'type Imported = import("./types").Imported;',
  ].join("\n");
  const parsed = parseModuleSpecifiers("module.ts", source);
  assert.deepEqual(parsed.parseErrors, []);
  assert.deepEqual(parsed.importErrors, []);
  assert.deepEqual(parsed.specifiers, [
    "./dynamic",
    "./legacy",
    "./required",
    "./types",
    "./value",
  ]);
});

test("ImportTypeNode edges receive normal production-to-test boundary checks", () =>
  withTempRoot((root) => {
    write(
      root,
      "apps/canvas/src/workspace/main.ts",
      'type Helper = import("src/test-support/helper").Helper;\n',
    );
    write(root, "apps/canvas/src/test-support/helper.ts", "export type Helper = string;\n");
    write(root, "packages/protocol/src/index.ts", "export {};\n");
    const result = evaluate(root);
    assert.ok(
      result.errors.some((error) => error.code === "production_imports_test_support"),
    );
  }));

test("nonliteral dynamic imports fail instead of disappearing from the graph", () =>
  withTempRoot((root) => {
    write(
      root,
      "apps/canvas/src/workspace/main.ts",
      'const name = "helper"; void import(`./${name}.ts`);\n',
    );
    write(root, "packages/protocol/src/index.ts", "export {};\n");
    const result = evaluate(root);
    assert.ok(result.errors.some((error) => error.code === "nonliteral_dynamic_import"));
  }));

test("import.meta glob calls are conservatively rejected for literal and nonliteral patterns", () =>
  withTempRoot((root) => {
    write(
      root,
      "apps/canvas/src/workspace/main.ts",
      [
        'import.meta.glob("src/test-support/*.ts");',
        'const pattern = "src/test-support/*.ts";',
        "import.meta.globEager(pattern);",
      ].join("\n"),
    );
    write(root, "apps/canvas/src/test-support/helper.ts", "export {};\n");
    write(root, "packages/protocol/src/index.ts", "export {};\n");
    const result = evaluate(root);
    const codes = new Set(result.errors.map((error) => error.code));
    assert.ok(codes.has("unsupported_import_meta_glob"));
    assert.ok(codes.has("nonliteral_import_meta_glob"));
  }));

test("two-argument dynamic imports participate in circular detection", () =>
  withTempRoot((root) => {
    write(root, "apps/canvas/src/workspace/a.ts", 'import "./b";\n');
    write(
      root,
      "apps/canvas/src/workspace/b.ts",
      'import("./a", { with: { type: "json" } });\n',
    );
    write(root, "packages/protocol/src/index.ts", "export {};\n");

    const result = evaluate(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.code === "circular_local_import"));
  }));

test("baseUrl imports cannot bypass test-support or tests directory rules", () =>
  withTempRoot((root) => {
    write(root, "apps/canvas/src/workspace/main.ts", [
      'import "src/test-support/helper";',
      'import "src/tests/helper";',
    ].join("\n"));
    write(root, "apps/canvas/src/test-support/helper.ts", "export {};\n");
    write(root, "apps/canvas/src/tests/helper.ts", "export {};\n");
    write(root, "packages/protocol/src/index.ts", "export {};\n");

    const result = evaluate(root);
    assert.equal(
      result.errors.filter((error) => error.code === "production_imports_test_support")
        .length,
      2,
    );
  }));

test("unresolved relative and configured baseUrl imports fail", () =>
  withTempRoot((root) => {
    write(root, "apps/canvas/src/workspace/main.ts", [
      'import "./missing";',
      'import "src/workspace/also-missing";',
    ].join("\n"));
    write(root, "packages/protocol/src/index.ts", "export {};\n");
    const result = evaluate(root);
    assert.equal(
      result.errors.filter((error) => error.code === "unresolved_local_import").length,
      2,
    );
  }));

test("forbidden dependency directions are reported independently", () =>
  withTempRoot((root) => {
    write(root, "apps/canvas/src/test-support/helper.ts", "export const helper = 1;\n");
    write(root, "apps/canvas/src/workspace/private.ts", "export const privateValue = 1;\n");
    write(root, "apps/canvas/src/workspace/index.ts", "export const publicValue = 1;\n");
    write(
      root,
      "apps/canvas/src/app-shell/main.ts",
      'import "../workspace/private";\nimport "../test-support/helper";\n',
    );
    write(
      root,
      "apps/canvas/src/design-system/Button.tsx",
      'import "../workspace/private";\nexport const Button = () => <button />;\n',
    );
    write(
      root,
      "packages/protocol/src/index.ts",
      'import "../../../apps/canvas/src/workspace/private";\n',
    );

    const result = evaluate(root);
    const codes = new Set(result.errors.map((error) => error.code));
    assert.ok(codes.has("production_imports_test_support"));
    assert.ok(codes.has("protocol_imports_application"));
    assert.ok(codes.has("design_system_imports_business_feature"));
    assert.ok(codes.has("cross_feature_private_import"));
  }));

test("an exact bounded debt record temporarily adjudicates a feature without an entry", () =>
  withTempRoot((root) => {
    const source = "apps/canvas/src/app-shell/main.ts";
    const target = "apps/canvas/src/workspace/private.ts";
    write(root, source, 'import "../workspace/private";\n');
    write(root, target, "export const privateValue = 1;\n");
    write(root, "packages/protocol/src/index.ts", "export {};\n");

    const result = evaluate(root, { version: 1, edges: [debtRecord(source, target)] });
    assert.equal(result.ok, true);
    assert.equal(result.allowedDebtEdges, 1);
  }));

test("unlisted, stale, overlong, and post-public-entry debt records fail", () =>
  withTempRoot((root) => {
    const source = "apps/canvas/src/app-shell/main.ts";
    const target = "apps/canvas/src/workspace/private.ts";
    write(root, source, 'import "../workspace/private";\n');
    write(root, target, "export const privateValue = 1;\n");
    write(root, "packages/protocol/src/index.ts", "export {};\n");

    assert.ok(
      evaluate(root).errors.some((error) => error.code === "cross_feature_private_import"),
    );
    assert.ok(
      evaluate(root, {
        version: 1,
        edges: [debtRecord(source, target, "2027-03-01")],
      }).errors.some((error) => error.code === "architecture_debt_review_too_distant"),
    );

    write(root, source, "export {};\n");
    assert.ok(
      evaluate(root, { version: 1, edges: [debtRecord(source, target)] }).errors.some(
        (error) => error.code === "architecture_debt_stale",
      ),
    );

    write(root, source, 'import "../workspace/private";\n');
    write(root, "apps/canvas/src/workspace/index.ts", "export {};\n");
    const publicResult = evaluate(root, {
      version: 1,
      edges: [debtRecord(source, target)],
    });
    assert.ok(
      publicResult.errors.some((error) => error.code === "cross_feature_private_import"),
    );
    assert.ok(
      publicResult.errors.some((error) => error.code === "architecture_debt_stale"),
    );
  }));

test("public feature entries, shared imports, assets, and protocol imports are valid", () =>
  withTempRoot((root) => {
    write(root, "apps/canvas/src/i18n/format.ts", "export const format = String;\n");
    write(root, "apps/canvas/src/settings/index.ts", "export const settings = 1;\n");
    write(root, "apps/canvas/src/workspace/styles.css", ".root {}\n");
    write(
      root,
      "apps/canvas/src/workspace/main.ts",
      'import { settings } from "../settings";\nimport "./styles.css";\nexport { settings };\n',
    );
    write(
      root,
      "apps/canvas/src/design-system/Button.tsx",
      'import { format } from "../i18n/format";\nexport const Button = () => <button>{format(1)}</button>;\n',
    );
    write(root, "packages/protocol/src/value.ts", "export const value = 1;\n");
    write(root, "packages/protocol/src/index.ts", 'export { value } from "./value";\n');

    const result = evaluate(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
  }));
